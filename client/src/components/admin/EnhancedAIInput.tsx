import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Mic, MicOff, Loader2, X } from "lucide-react";

interface EnhancedAIInputProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  isListening?: boolean;
  onToggleVoice?: () => void;
  browserSupported?: boolean;
  placeholder?: string;
  examples?: string[];
  disabled?: boolean;
  sectionType?: string;
  onClear?: () => void;
}

export function EnhancedAIInput({
  prompt,
  onPromptChange,
  onGenerate,
  isGenerating,
  isListening = false,
  onToggleVoice,
  browserSupported = false,
  placeholder = "Describe what you want to add in natural language...",
  examples = [],
  disabled = false,
  sectionType = "entries",
  onClear,
}: EnhancedAIInputProps) {
  return (
    <div className="space-y-3">
      <Card className="border border-gray-300 shadow-sm">
        <CardContent className="pt-4 space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-2.5">
            <p className="text-xs text-blue-800">
              <span className="font-semibold">AI Smart Add:</span> Describe your {sectionType} in plain language. AI will structure it for you.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Describe Your Information
            </Label>
            <div className="relative">
              <Textarea
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                placeholder={placeholder}
                rows={5}
                className="pr-20 text-sm resize-none border-2 border-gray-300 focus:border-purple-500 transition-colors"
                disabled={disabled || isGenerating}
              />
              <div className="absolute bottom-2 right-2 flex gap-1">
                {prompt && !disabled && !isGenerating && onClear && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 hover:bg-gray-100"
                    onClick={onClear}
                    title="Clear text"
                  >
                    <X className="h-4 w-4 text-gray-600" />
                  </Button>
                )}
                {browserSupported && onToggleVoice && !disabled && !isGenerating && (
                  <Button
                    type="button"
                    size="icon"
                    variant={isListening ? "destructive" : "ghost"}
                    className="h-8 w-8 hover:bg-gray-100"
                    onClick={onToggleVoice}
                    title={isListening ? "Stop listening" : "Voice input"}
                  >
                    {isListening ? (
                      <MicOff className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4 text-gray-600" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            {isListening && (
              <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-xs font-medium text-green-700">
                  Listening...
                </span>
              </div>
            )}

            {examples.length > 0 && (
              <details className="text-xs text-gray-600">
                <summary className="cursor-pointer font-medium hover:text-gray-900">
                  View examples
                </summary>
                <div className="mt-2 space-y-1 pl-2">
                  {examples.map((example, index) => (
                    <div key={index} className="text-gray-600 italic">
                      • {example}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          <Button
            onClick={onGenerate}
            disabled={isGenerating || !prompt.trim() || disabled}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-2 shadow-md"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                <span>Generate with AI</span>
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
