// Event Types
export interface Event {
  id: string;
  name: string;
  code: string;
  description: string;
  date: string;
  address: string;
  lat: number;
  lng: number;
  ticketPrice: number;
  telegramChatId?: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
  indoorMap?: IndoorMap;
}

export interface IndoorMap {
  url: string;
  pois: POI[];
}

export interface POI {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface CreateEventData {
  name: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  date: string;
  ticketPrice: number;
  telegramChatId?: string;
  userId: string;
}

export interface UpdateEventData extends Partial<CreateEventData> {
  id: string;
}

// Registration Types
export interface Registration {
  id: string;
  eventId: string;
  eventCode?: string;
  name: string;
  email: string;
  phone?: string;
  paymentStatus: "pending" | "completed" | "failed" | "paid";
  paymentId?: string;
  orderId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  amount?: number;
  createdAt?: string;
  paidAt?: string;
}

export interface CreateRegistrationData {
  eventCode: string;
  name: string;
  email: string;
  phone: string;
  amount: number;
}

export interface VerifyPaymentData {
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
  registrationId: string;
}

// Ticket Types
export interface Ticket {
  id: string;
  eventId: string;
  eventCode: string;
  question: string;
  autoAnswer?: string;
  answer?: string;
  status: "open" | "answered" | "closed" | "flagged";
  createdAt?: string;
  updatedAt?: string;
  telegramChatId?: string;
  telegramMessageId?: number;
}

export interface TicketReplyData {
  ticketId: string;
  answer: string;
}

export interface UpdateTicketStatusData {
  ticketId: string;
  status: Ticket["status"];
}

// Poll Types
export interface PollData {
  chatId: string;
  question: string;
  options: string[];
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Dashboard Stats
export interface EventStats {
  totalEvents: number;
  totalRegistrations: number;
  totalRevenue: number;
  activeEvents: number;
}

// Form Types
export interface EventFormData {
  name: string;
  description: string;
  address: string;
  lat: string;
  lng: string;
  date: string;
  ticketPrice: string;
  telegramChatId: string;
}
