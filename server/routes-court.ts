import { Express } from "express";
import { z } from "zod";
import { courtSessionManager } from "./court-session-manager";
import { analyzeCourtQuery, getCourtDataFetchStrategy, extractImageSearchKeywords } from "./court-query-analyzer";
import { supabase } from "./supabase";
import OpenAI from "openai";
import Groq from "groq-sdk";
import { normalizeTextForTTS } from "./text-normalizer";
import { lookupCourtInfo } from "./court-static-data";

const askSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
});

const ttsSchema = z.object({
  text: z.string().min(1),
  voice: z.string().optional(),
  speed: z.number().optional(),
});

export async function registerCourtRoutes(app: Express) {
  // Court AI Assistant - Main Query Endpoint
  app.post("/api/court/ask", async (req, res) => {
    try {
      const { message, sessionId } = askSchema.parse(req.body);
      
      console.log(`\n🏛️ Court Assistant Query: "${message}"`);

      // Get or create session
      const { sessionId: activeSessionId, session } = courtSessionManager.getOrCreateSession(sessionId);

      // Analyze query
      const analysis = analyzeCourtQuery(message);
      const strategy = getCourtDataFetchStrategy(analysis);

      console.log('Court Query Analysis:', {
        topics: analysis.topics,
        entities: analysis.entityMentions,
        strategy
      });

      // PRIORITY: Try static lookup first for instant deterministic responses
      const staticLookup = lookupCourtInfo(message);
      
      if (staticLookup.matched) {
        console.log(`✅ Static lookup matched! Type: ${staticLookup.type}, Room: ${staticLookup.roomNumber || 'N/A'}`);
        
        // Build building image response structure
        const buildingImages = staticLookup.buildingData ? [{
          id: `static-${staticLookup.building}`,
          title: staticLookup.buildingData.name,
          description: staticLookup.buildingData.description,
          image_url: staticLookup.imageUrl || staticLookup.buildingData.image,
          room_number: staticLookup.roomNumber?.toString(),
          building_name: staticLookup.buildingData.name
        }] : [];
        
        const assistantResponse = staticLookup.responseText || "";
        
        // Save conversation
        courtSessionManager.addMessage(activeSessionId, 'user', message);
        courtSessionManager.addMessage(activeSessionId, 'assistant', assistantResponse);
        
        console.log(`✅ Court Assistant Response (Static Lookup) - ${assistantResponse.length} chars`);
        
        return res.json({
          response: assistantResponse,
          sessionId: activeSessionId,
          buildingImages: buildingImages,
          metadata: {
            hasRoomInfo: !!staticLookup.roomNumber,
            hasBuildingInfo: !!staticLookup.building,
            hasStaffInfo: false,
            hasBuildingImages: buildingImages.length > 0,
            isStaticLookup: true
          }
        });
      }
      
      console.log('No static lookup match, proceeding with AI-powered response...');

      // Fetch relevant court data from Supabase
      let contextData: any = {
        rooms: [],
        buildings: [],
        staff: [],
        files: [],
        timings: [],
        settings: {},
        buildingImages: []
      };

      try {
        // Fetch courtrooms
        if (strategy.shouldFetchRooms) {
          const { data: rooms, error } = await supabase
            .from('court_rooms')
            .select('*')
            .eq('is_active', true)
            .limit(strategy.roomsLimit);
          
          if (!error && rooms) contextData.rooms = rooms;
        }

        // Fetch buildings
        if (strategy.shouldFetchBuildings) {
          const { data: buildings, error } = await supabase
            .from('court_buildings')
            .select('*')
            .eq('is_active', true)
            .limit(strategy.buildingsLimit);
          
          if (!error && buildings) contextData.buildings = buildings;
        }

        // Fetch staff
        if (strategy.shouldFetchStaff) {
          const { data: staff, error } = await supabase
            .from('court_staff')
            .select('*')
            .eq('is_active', true)
            .limit(strategy.staffLimit);
          
          if (!error && staff) contextData.staff = staff;
        }

        // Fetch files
        if (strategy.shouldFetchFiles) {
          const { data: files, error } = await supabase
            .from('court_files')
            .select('*')
            .eq('status', 'active')
            .limit(strategy.filesLimit);
          
          if (!error && files) contextData.files = files;
        }

        // Fetch timings
        if (strategy.shouldFetchTimings) {
          const { data: timings, error } = await supabase
            .from('court_timings')
            .select('*')
            .limit(10);
          
          if (!error && timings) contextData.timings = timings;
        }

        // Fetch court settings
        if (strategy.shouldFetchSettings) {
          const { data: settings, error } = await supabase
            .from('court_settings')
            .select('*')
            .limit(10);
          
          if (!error && settings) {
            contextData.settings = settings.reduce((acc: any, setting: any) => {
              acc[setting.key] = setting.value;
              return acc;
            }, {});
          }
        }

        // Fetch building images for location/navigation queries
        if (strategy.shouldFetchBuildingImages) {
          const searchKeywords = extractImageSearchKeywords(message);
          console.log('Building image search keywords:', searchKeywords);

          if (searchKeywords.length > 0) {
            // Search building images by matching keywords in title, description, or room_number
            const { data: buildingImages, error } = await supabase
              .from('court_building_images')
              .select('*')
              .limit(strategy.buildingImagesLimit);

            if (!error && buildingImages) {
              // Filter images based on keywords
              const matchingImages = buildingImages.filter((img: any) => {
                const searchableText = `${img.title} ${img.description} ${img.room_number} ${img.building_name} ${img.department}`.toLowerCase();
                return searchKeywords.some(keyword => searchableText.includes(keyword.toLowerCase()));
              });

              contextData.buildingImages = matchingImages.length > 0 ? matchingImages : buildingImages.slice(0, 3);
            }
          } else {
            // If no specific keywords, fetch a few general images
            const { data: buildingImages, error } = await supabase
              .from('court_building_images')
              .select('*')
              .limit(3);
            
            if (!error && buildingImages) contextData.buildingImages = buildingImages;
          }
        }
      } catch (dbError) {
        console.error('Court database fetch error:', dbError);
      }

      // Build professional system prompt for Court AI
      const systemPrompt = buildCourtSystemPrompt(contextData);

      // Get conversation history
      const messages = courtSessionManager.getConversationHistory(activeSessionId, systemPrompt);

      // Add current user message
      messages.push({ role: 'user', content: message });

      // LLM with Fallback: OpenAI GPT-4o → Groq Llama
      let assistantResponse = "";
      
      try {
        // PRIMARY: Try OpenAI GPT-4o first
        console.log('🤖 Court Assistant: Trying OpenAI GPT-4o...');
        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: messages as any[],
          temperature: 0.7,
          max_completion_tokens: 1000,
        });

        assistantResponse = completion.choices[0]?.message?.content || "";
        console.log('✅ OpenAI GPT-4o Success');

      } catch (openaiError: any) {
        // FALLBACK: Use Groq if OpenAI fails
        console.warn('⚠️ OpenAI GPT-4o failed, falling back to Groq...', openaiError.message);
        
        try {
          const groq = new Groq({
            apiKey: process.env.GROQ_API_KEY, // Assistant Groq key
          });

          const groqCompletion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: messages as any[],
            temperature: 0.7,
            max_tokens: 1000,
          });

          assistantResponse = groqCompletion.choices[0]?.message?.content || "";
          console.log('✅ Groq Llama Success (Fallback)');

        } catch (groqError: any) {
          console.error('❌ Both OpenAI and Groq failed:', groqError.message);
          assistantResponse = "I apologize, but I'm experiencing technical difficulties. Please try again in a moment.";
        }
      }

      if (!assistantResponse) {
        assistantResponse = "I apologize, but I couldn't process your request. Please try again.";
      }

      // Save conversation
      courtSessionManager.addMessage(activeSessionId, 'user', message);
      courtSessionManager.addMessage(activeSessionId, 'assistant', assistantResponse);

      console.log(`✅ Court Assistant Response Generated (${assistantResponse.length} chars)`);

      res.json({
        response: assistantResponse,
        sessionId: activeSessionId,
        buildingImages: contextData.buildingImages || [],
        metadata: {
          hasRoomInfo: contextData.rooms.length > 0,
          hasBuildingInfo: contextData.buildings.length > 0,
          hasStaffInfo: contextData.staff.length > 0,
          hasBuildingImages: (contextData.buildingImages || []).length > 0
        }
      });

    } catch (error: any) {
      console.error('Court assistant error:', error);
      res.status(500).json({
        response: "I apologize for the inconvenience. There was an error processing your request. Please try again.",
        error: error.message
      });
    }
  });

  // ElevenLabs TTS Endpoint for Court Assistant (Hinglish optimized)
  app.post("/api/court/tts", async (req, res) => {
    try {
      const { text, voice, speed } = ttsSchema.parse(req.body);

      if (!text || text.trim().length === 0) {
        return res.status(400).json({
          message: "Text cannot be empty",
          error: "EMPTY_TEXT"
        });
      }

      console.log(`🔊 Court TTS Request (ElevenLabs): ${text.substring(0, 50)}...`);

      const elevenlabsApiKey = process.env.ELEVENLABS_API_KEY;
      
      if (!elevenlabsApiKey || elevenlabsApiKey === 'your_elevenlabs_api_key_here') {
        console.error('❌ ElevenLabs API key not configured');
        return res.status(500).json({
          message: "TTS service not configured",
          error: "ELEVENLABS_KEY_MISSING"
        });
      }

      // Comprehensive text cleaning for TTS - remove ALL markdown and special formatting
      const cleanTextForSpeech = (text: string) => {
        return text
          .replace(/\|/g, ' ')
          .replace(/---+/g, '. ')
          .replace(/#{1,6}\s+/g, '')
          // Remove triple asterisks first (before double)
          .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
          // Remove double asterisks (bold)
          .replace(/\*\*(.*?)\*\*/g, '$1')
          // Remove single asterisks (italic)
          .replace(/\*(.*?)\*/g, '$1')
          // Remove underscores (bold/italic)
          .replace(/__(.*?)__/g, '$1')
          .replace(/_(.*?)_/g, '$1')
          // Remove inline code
          .replace(/`(.*?)`/g, '$1')
          // Remove markdown links [text](url) - keep only text
          .replace(/\[(.*?)\]\(.*?\)/g, '$1')
          // Remove standalone URLs in parentheses
          .replace(/\(https?:\/\/[^\)]+\)/g, '')
          // Remove emojis
          .replace(/📊|📌|🎓|⏰|📞|⚖️|✅|❌|🔊|🎯|📧|📍/g, '')
          // Clean up multiple spaces
          .replace(/\s+/g, ' ')
          .trim();
      };

      const cleanedText = cleanTextForSpeech(text);
      
      // Apply text normalization for proper pronunciation of times, phone numbers, emails, etc.
      const normalizedText = normalizeTextForTTS(cleanedText);
      const textToSpeak = normalizedText;

      console.log(`Court TTS: Processing text (${textToSpeak.length} characters)...`);
      console.log(`Court TTS: Normalized text preview: "${textToSpeak.substring(0, 100)}..."`);

      // ElevenLabs has a ~5000 character limit - enforce safe limit to avoid API errors
      const MAX_CHAR_LIMIT = 4500;
      let finalText = textToSpeak;
      
      if (textToSpeak.length > MAX_CHAR_LIMIT) {
        console.warn(`⚠️ Court TTS: Text exceeds ${MAX_CHAR_LIMIT} chars (${textToSpeak.length}). Truncating to fit ElevenLabs limit...`);
        
        // Intelligent truncation: find last complete sentence within limit
        finalText = textToSpeak.substring(0, MAX_CHAR_LIMIT);
        const lastPeriod = finalText.lastIndexOf('.');
        const lastQuestion = finalText.lastIndexOf('?');
        const lastExclamation = finalText.lastIndexOf('!');
        
        const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
        if (lastSentenceEnd > MAX_CHAR_LIMIT * 0.8) {
          // If we found a sentence end in the last 20%, use it
          finalText = textToSpeak.substring(0, lastSentenceEnd + 1);
        }
        
        console.log(`Court TTS: Truncated to ${finalText.length} characters at sentence boundary`);
      }

      // ElevenLabs multilingual voice for Hinglish
      // Using custom voice ID with optimized settings for smooth natural speech
      const voiceId = voice || "3AMU7jXQuQa3oRvRqUmb"; // Custom voice for Hinglish
      const modelId = "eleven_multilingual_v2"; // Best for Hinglish

      // Process entire text in one go for smooth continuous speech (no chunking!)
      const requestBody = {
        text: finalText,
        model_id: modelId,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true
        }
      };

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenlabsApiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetails = errorText;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorDetails = errorJson.detail || errorJson.message || errorText;
        } catch {
          // Keep original errorText if not JSON
        }
        
        console.error(`❌ Court TTS failed (${response.status}):`, errorDetails);
        
        // Provide specific error messages for common issues
        if (response.status === 413 || errorDetails.includes('too long')) {
          throw new Error(`Text too long for TTS provider (max ~5000 chars)`);
        } else if (response.status === 401 || response.status === 403) {
          throw new Error(`TTS authentication failed - check API key`);
        } else if (response.status === 429) {
          throw new Error(`TTS rate limit exceeded - please try again`);
        } else {
          throw new Error(`ElevenLabs API error (${response.status}): ${errorDetails}`);
        }
      }

      const audioBuffer = await response.arrayBuffer();
      const finalAudio = Buffer.from(audioBuffer);

      console.log(`✅ Court TTS: Complete! Generated ${finalAudio.length} bytes of continuous audio`);

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': finalAudio.length,
        'X-TTS-Provider': 'elevenlabs',
        'X-TTS-Mode': 'continuous'
      });

      res.send(finalAudio);

    } catch (error: any) {
      console.error('❌ Court TTS error:', error);
      res.status(500).json({
        message: "TTS generation failed",
        error: error.message
      });
    }
  });

  // OpenAI TTS Endpoint for Court Assistant (Fallback with "ash" voice)
  app.post("/api/court/tts-openai", async (req, res) => {
    try {
      const { text } = ttsSchema.parse(req.body);

      if (!text || text.trim().length === 0) {
        return res.status(400).json({
          message: "Text cannot be empty",
          error: "EMPTY_TEXT"
        });
      }

      console.log(`🔊 Court TTS Request (OpenAI - ash voice): ${text.substring(0, 50)}...`);

      const openaiApiKey = process.env.OPENAI_API_KEY;
      
      if (!openaiApiKey) {
        console.error('❌ OpenAI API key not configured');
        return res.status(500).json({
          message: "OpenAI TTS service not configured",
          error: "OPENAI_KEY_MISSING"
        });
      }

      // Comprehensive text cleaning for TTS - remove ALL markdown and special formatting
      const cleanTextForSpeech = (text: string) => {
        return text
          .replace(/\|/g, ' ')
          .replace(/---+/g, '. ')
          .replace(/#{1,6}\s+/g, '')
          // Remove triple asterisks first (before double)
          .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
          // Remove double asterisks (bold)
          .replace(/\*\*(.*?)\*\*/g, '$1')
          // Remove single asterisks (italic)
          .replace(/\*(.*?)\*/g, '$1')
          // Remove underscores (bold/italic)
          .replace(/__(.*?)__/g, '$1')
          .replace(/_(.*?)_/g, '$1')
          // Remove inline code
          .replace(/`(.*?)`/g, '$1')
          // Remove markdown links [text](url) - keep only text
          .replace(/\[(.*?)\]\(.*?\)/g, '$1')
          // Remove standalone URLs in parentheses
          .replace(/\(https?:\/\/[^\)]+\)/g, '')
          // Remove emojis
          .replace(/📊|📌|🎓|⏰|📞|⚖️|✅|❌|🔊|🎯|📧|📍/g, '')
          // Clean up multiple spaces
          .replace(/\s+/g, ' ')
          .trim();
      };

      const cleanedText = cleanTextForSpeech(text);
      
      // Apply text normalization for proper pronunciation of times, phone numbers, emails, etc.
      const normalizedText = normalizeTextForTTS(cleanedText);

      console.log(`Court TTS (OpenAI): Processing text (${normalizedText.length} characters)...`);
      console.log(`Court TTS (OpenAI): Normalized text preview: "${normalizedText.substring(0, 100)}..."`);

      // OpenAI TTS has a 4096 character limit
      const MAX_CHAR_LIMIT = 4000;
      let finalText = normalizedText;
      
      if (normalizedText.length > MAX_CHAR_LIMIT) {
        console.warn(`⚠️ Court TTS (OpenAI): Text exceeds ${MAX_CHAR_LIMIT} chars. Truncating...`);
        
        finalText = normalizedText.substring(0, MAX_CHAR_LIMIT);
        const lastPeriod = finalText.lastIndexOf('.');
        const lastQuestion = finalText.lastIndexOf('?');
        const lastExclamation = finalText.lastIndexOf('!');
        
        const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
        if (lastSentenceEnd > MAX_CHAR_LIMIT * 0.8) {
          finalText = normalizedText.substring(0, lastSentenceEnd + 1);
        }
      }

      // OpenAI TTS API Call - using "ash" voice for natural, smooth speech
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: finalText,
          voice: 'ash',
          speed: 1.0
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ OpenAI TTS failed (${response.status}):`, errorText);
        throw new Error(`OpenAI TTS API error (${response.status})`);
      }

      const audioBuffer = await response.arrayBuffer();
      const finalAudio = Buffer.from(audioBuffer);

      console.log(`✅ Court TTS (OpenAI): Complete! Generated ${finalAudio.length} bytes with ash voice`);

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': finalAudio.length,
        'X-TTS-Provider': 'openai',
        'X-TTS-Voice': 'ash',
        'X-TTS-Mode': 'continuous'
      });

      res.send(finalAudio);

    } catch (error: any) {
      console.error('❌ Court TTS (OpenAI) error:', error);
      res.status(500).json({
        message: "OpenAI TTS generation failed",
        error: error.message
      });
    }
  });
}

function buildCourtSystemPrompt(contextData: any): string {
  const { rooms, buildings, staff, files, timings, settings, buildingImages } = contextData;

  let prompt = `You are the Kaithal District Court AI Assistant - a professional, helpful, and knowledgeable virtual guide for the Kaithal District Court in Haryana, India.

**YOUR ROLE:**
- Guide visitors, lawyers, litigants, and staff through the court premises
- Provide accurate information about courtroom locations, file tracking, and staff directories
- Help users navigate the court complex efficiently
- Answer questions about court procedures, timings, and facilities
- Maintain a professional, respectful, and courteous tone at all times

**LANGUAGE & COMMUNICATION STYLE:**
- **PRIMARY LANGUAGE**: Always respond in Hinglish (Hindi + English mix) by default
- Use Hindi words mixed with English naturally, like people speak in India: "Courtroom number 5 main hall ke left side par hai"
- Examples of Hinglish responses:
  * "Ji haan, main aapki madad kar sakta hoon. Courtroom 5 ground floor par hai."
  * "File tracking ke liye aapko registry office jana hoga jo building A mein hai."
  * "Staff directory dekhne ke liye main aapko details de sakta hoon."
- **ENGLISH MODE**: If user specifically asks in pure English or says "speak in English", then respond in pure English
- Be professional yet approachable
- Use simple, clear language that anyone can understand
- Be concise but comprehensive
- Always be respectful and helpful
- Use bullet points for clarity when providing multiple details
- When giving directions, be specific about building, floor, and room numbers

**CRITICAL FORMATTING RULES - MUST FOLLOW:**
- NEVER use ANY markdown formatting: no **, ***, *, __, [], (), etc.
- NEVER use bold, italic, or links in your responses
- Keep responses simple and plain text only
- Use simple dashes (-) for lists, nothing else
- DO NOT wrap text in asterisks or any special characters

**CORRECT FORMAT (Use this):**
"Court ka email hai kaithalcourt@gov.in aur phone number hai +91-1746-234567"
"Email: kaithalcourt@gov.in"
"Reception: +91-1746-234567"

**WRONG FORMAT (Never use this):**
"**Email:** kaithalcourt@gov.in" ❌
"[website](https://example.com)" ❌
"***Important:*** Contact us" ❌

This is essential for voice assistant - markdown breaks text-to-speech!

**CURRENT COURT DATA:**\n\n`;

  // Add court settings
  if (settings && Object.keys(settings).length > 0) {
    prompt += `**Court Information:**\n`;
    Object.entries(settings).forEach(([key, value]) => {
      prompt += `- ${key}: ${JSON.stringify(value)}\n`;
    });
    prompt += `\n`;
  }

  // Add buildings info
  if (buildings && buildings.length > 0) {
    prompt += `**Court Buildings:**\n`;
    buildings.forEach((building: any) => {
      prompt += `- ${building.building_name} (${building.building_code || 'N/A'})\n`;
      if (building.description) prompt += `  Description: ${building.description}\n`;
      if (building.total_floors) prompt += `  Floors: ${building.total_floors}\n`;
      if (building.location_details) prompt += `  Location: ${building.location_details}\n`;
    });
    prompt += `\n`;
  }

  // Add rooms info
  if (rooms && rooms.length > 0) {
    prompt += `**Courtrooms & Offices:**\n`;
    rooms.slice(0, 30).forEach((room: any) => {
      prompt += `- Room ${room.room_number}: ${room.room_name || room.room_type}\n`;
      if (room.room_purpose) prompt += `  Purpose: ${room.room_purpose}\n`;
      if (room.floor_number) prompt += `  Floor: ${room.floor_number}\n`;
      if (room.incharge_name) prompt += `  In-charge: ${room.incharge_name}\n`;
      if (room.timings) prompt += `  Timings: ${room.timings}\n`;
    });
    prompt += `\n`;
  }

  // Add staff info
  if (staff && staff.length > 0) {
    prompt += `**Court Staff:**\n`;
    staff.slice(0, 20).forEach((person: any) => {
      prompt += `- ${person.staff_name} - ${person.designation}\n`;
      if (person.department) prompt += `  Department: ${person.department}\n`;
      if (person.specialization) prompt += `  Specialization: ${person.specialization}\n`;
      if (person.office_hours) prompt += `  Office Hours: ${person.office_hours}\n`;
    });
    prompt += `\n`;
  }

  // Add timings
  if (timings && timings.length > 0) {
    prompt += `**Court Timings:**\n`;
    timings.forEach((timing: any) => {
      prompt += `- ${timing.facility_name}: ${timing.opening_time} - ${timing.closing_time}\n`;
      if (timing.days) prompt += `  Days: ${timing.days.join(', ')}\n`;
      if (timing.special_notes) prompt += `  Note: ${timing.special_notes}\n`;
    });
    prompt += `\n`;
  }

  // Add file tracking info if available
  if (files && files.length > 0) {
    prompt += `**Recent File Locations:**\n`;
    files.slice(0, 10).forEach((file: any) => {
      prompt += `- File ${file.file_number}: ${file.current_location}\n`;
      if (file.file_type) prompt += `  Type: ${file.file_type}\n`;
      if (file.status) prompt += `  Status: ${file.status}\n`;
    });
    prompt += `\n`;
  }

  // Add building images for visual context
  if (buildingImages && buildingImages.length > 0) {
    prompt += `**Available Building Images (for location/navigation help):**\n`;
    buildingImages.forEach((img: any) => {
      prompt += `- ${img.title}\n`;
      if (img.description) prompt += `  Description: ${img.description}\n`;
      if (img.room_number) prompt += `  Room: ${img.room_number}\n`;
      if (img.building_name) prompt += `  Building: ${img.building_name}\n`;
      if (img.department) prompt += `  Department: ${img.department}\n`;
      if (img.contact_person) prompt += `  Contact: ${img.contact_person}\n`;
      prompt += `  Image available: Yes (will be shown to user)\n`;
    });
    prompt += `\n`;
    prompt += `**NOTE**: When answering location/navigation questions, if there's a relevant building image available, mention that an image is being shown to help them visualize the location.\n\n`;
  }

  prompt += `**IMPORTANT GUIDELINES:**
- If a user asks about a specific file, room, or staff member, provide complete details including location, timings, and contact information
- When describing locations, always mention: Building name → Floor → Room number
- If you don't have specific information, politely inform the user and suggest they contact the court office
- For legal procedures, provide general guidance but advise consulting with court staff or legal professionals for specific cases
- Always maintain confidentiality and professionalism

Remember: You are here to help people navigate the court system easily and efficiently. Be patient, clear, and helpful!`;

  return prompt;
}
