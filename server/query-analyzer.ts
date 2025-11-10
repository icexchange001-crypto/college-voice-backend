/**
 * Smart Query Analyzer - NLU Module
 * Analyzes user queries to determine what data to fetch from database
 */

export interface QueryTopics {
  courses: boolean;
  staff: boolean;
  events: boolean;
  notices: boolean;
  departments: boolean;
  fees: boolean;
  facilities: boolean;
  admissions: boolean;
  general: boolean;
  greeting: boolean;
}

export interface QueryAnalysis {
  topics: QueryTopics;
  entityMentions: {
    courseName?: string;
    staffName?: string;
    departmentName?: string;
    dateReference?: string;
  };
  needsDetailedInfo: boolean;
}

/**
 * Analyzes user query and returns what topics/data are relevant
 */
export function analyzeQueryTopics(query: string): QueryAnalysis {
  const lowerQuery = query.toLowerCase();
  
  // Initialize all topics as false
  const topics: QueryTopics = {
    courses: false,
    staff: false,
    events: false,
    notices: false,
    departments: false,
    fees: false,
    facilities: false,
    admissions: false,
    general: false,
    greeting: false
  };

  const entityMentions: any = {};

  // Greeting detection
  const greetingPatterns = ['hello', 'hi', 'namaste', 'namaskar', 'hey', 'good morning', 'good evening', 'hii', 'hiii'];
  if (greetingPatterns.some(pattern => lowerQuery.includes(pattern)) && lowerQuery.length < 30) {
    topics.greeting = true;
    return { topics, entityMentions, needsDetailedInfo: false };
  }

  // Courses detection
  const courseKeywords = ['course', 'courses', 'degree', 'ba', 'bsc', 'bcom', 'ma', 'msc', 'mcom', 'bba', 'bca', 'program', 'programme', 'stream', 'subject', 'पाठ्यक्रम', 'कोर्स'];
  if (courseKeywords.some(keyword => lowerQuery.includes(keyword))) {
    topics.courses = true;
  }

  // Staff detection
  const staffKeywords = ['teacher', 'professor', 'staff', 'faculty', 'principal', 'hod', 'head', 'lecturer', 'sir', 'madam', 'शिक्षक', 'टीचर'];
  if (staffKeywords.some(keyword => lowerQuery.includes(keyword))) {
    topics.staff = true;
  }

  // Events detection
  const eventKeywords = ['event', 'fest', 'festival', 'function', 'celebration', 'program', 'activity', 'competition', 'seminar', 'workshop', 'कार्यक्रम', 'इवेंट'];
  if (eventKeywords.some(keyword => lowerQuery.includes(keyword))) {
    topics.events = true;
  }

  // Notices detection
  const noticeKeywords = ['notice', 'notification', 'announcement', 'update', 'circular', 'सूचना', 'नोटिस'];
  if (noticeKeywords.some(keyword => lowerQuery.includes(keyword))) {
    topics.notices = true;
  }

  // Departments detection
  const deptKeywords = ['department', 'dept', 'विभाग'];
  if (deptKeywords.some(keyword => lowerQuery.includes(keyword))) {
    topics.departments = true;
  }

  // Fees detection
  const feeKeywords = ['fee', 'fees', 'cost', 'price', 'charge', 'payment', 'फीस', 'शुल्क'];
  if (feeKeywords.some(keyword => lowerQuery.includes(keyword))) {
    topics.fees = true;
    topics.courses = true; // Fees usually related to courses
  }

  // Facilities detection
  const facilityKeywords = ['library', 'lab', 'laboratory', 'canteen', 'hostel', 'bus', 'transport', 'ground', 'playground', 'facility', 'facilities', 'सुविधा'];
  if (facilityKeywords.some(keyword => lowerQuery.includes(keyword))) {
    topics.facilities = true;
  }

  // Admissions detection
  const admissionKeywords = ['admission', 'apply', 'application', 'registration', 'enroll', 'join', 'प्रवेश', 'एडमिशन'];
  if (admissionKeywords.some(keyword => lowerQuery.includes(keyword))) {
    topics.admissions = true;
    topics.courses = true; // Admissions usually need course info
  }

  // If no specific topic detected, mark as general
  const hasAnyTopic = Object.entries(topics).some(([key, value]) => key !== 'general' && key !== 'greeting' && value);
  if (!hasAnyTopic) {
    topics.general = true;
  }

  // Determine if detailed info is needed
  const detailKeywords = ['detail', 'explain', 'tell me about', 'information', 'batao', 'बताओ', 'विस्तार'];
  const needsDetailedInfo = detailKeywords.some(keyword => lowerQuery.includes(keyword)) || lowerQuery.length > 50;

  return {
    topics,
    entityMentions,
    needsDetailedInfo
  };
}

/**
 * Get data fetch strategy based on query analysis
 */
export function getDataFetchStrategy(analysis: QueryAnalysis): {
  fetchCourses: boolean;
  fetchStaff: boolean;
  fetchEvents: boolean;
  fetchNotices: boolean;
  fetchDepartments: boolean;
  fetchSettings: boolean;
  fetchDepartmentData: boolean;
  coursesLimit?: number;
  staffLimit?: number;
  eventsLimit?: number;
  noticesLimit?: number;
} {
  const strategy = {
    fetchCourses: false,
    fetchStaff: false,
    fetchEvents: false,
    fetchNotices: false,
    fetchDepartments: false,
    fetchSettings: false,
    fetchDepartmentData: false
  };

  // For greetings, fetch minimal data
  if (analysis.topics.greeting) {
    return { ...strategy, fetchSettings: true };
  }

  // For general queries, fetch basic info
  if (analysis.topics.general) {
    return {
      ...strategy,
      fetchCourses: true,
      fetchDepartments: true,
      fetchSettings: true,
      coursesLimit: 50,  // Fetch more courses for general queries
    };
  }

  // Fetch based on detected topics
  if (analysis.topics.courses || analysis.topics.fees || analysis.topics.admissions) {
    strategy.fetchCourses = true;
  }

  if (analysis.topics.staff) {
    strategy.fetchStaff = true;
  }

  if (analysis.topics.events) {
    strategy.fetchEvents = true;
  }

  if (analysis.topics.notices) {
    strategy.fetchNotices = true;
  }

  if (analysis.topics.departments) {
    strategy.fetchDepartments = true;
    strategy.fetchDepartmentData = true;
  }

  if (analysis.topics.facilities) {
    strategy.fetchSettings = true;
    strategy.fetchDepartmentData = true;
  }

  // Set appropriate limits based on query detail level
  // OPTIMIZED: Fetch ALL data for comprehensive responses
  const limits: any = {};
  if (analysis.needsDetailedInfo) {
    limits.coursesLimit = 100;  // Fetch all courses
    limits.staffLimit = 50;     // Fetch all staff
    limits.eventsLimit = 30;    // Fetch all events
    limits.noticesLimit = 30;   // Fetch all notices
  } else {
    // Even for non-detailed queries, fetch more data for better context
    limits.coursesLimit = 50;
    limits.staffLimit = 30;
    limits.eventsLimit = 15;
    limits.noticesLimit = 15;
  }

  return { ...strategy, ...limits };
}
