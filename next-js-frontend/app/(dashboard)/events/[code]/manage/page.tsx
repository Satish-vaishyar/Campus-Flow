"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  Calendar,
  MapPin,
  DollarSign,
  FileText,
  MessageSquare,
  Users,
  BarChart3,
  Upload,
  Send,
  Flag,
  Check,
  X,
  ExternalLink,
  Loader2,
  Copy,
  Image as ImageIcon,
  Trash2,
} from "lucide-react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { PageHeader } from "@/components/core/page-header"
import { EmptyState } from "@/components/core/empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EventMap, QRCodeGenerator, QRCodeScanner } from "@/components/features"
import { useEvent, useUploadDocument, useUploadIndoorMap, useDeleteEvent } from "@/hooks/use-events"
import { useTickets, useReplyToTicket, useUpdateTicketStatus } from "@/hooks/use-tickets"
import { useRegistrations } from "@/hooks/use-registrations"
import { useSendPoll } from "@/hooks/use-webhooks"
import { toast } from "sonner"
import { format } from "date-fns"
import type { Ticket, Registration } from "@/types/event"

export default function EventManagePage() {
  const params = useParams()
  const router = useRouter()
  const eventCode = params.code as string

  const { data: event, isLoading: eventLoading } = useEvent(eventCode)
  const { data: tickets, isLoading: ticketsLoading } = useTickets(eventCode)
  const { data: registrations, isLoading: registrationsLoading } = useRegistrations(eventCode)

  const uploadDocument = useUploadDocument()
  const uploadIndoorMap = useUploadIndoorMap()
  const replyToTicket = useReplyToTicket()
  const updateTicketStatus = useUpdateTicketStatus()
  const sendPoll = useSendPoll()
  const deleteEvent = useDeleteEvent()

  const [activeTab, setActiveTab] = useState("overview")
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [pollQuestion, setPollQuestion] = useState("")
  const [pollOptions, setPollOptions] = useState(["", ""])
  const [isDeleting, setIsDeleting] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success("Copied to clipboard!")
  }

  const handleDelete = async () => {
    if (!event) return

    if (!confirm(`Are you sure you want to delete "${event.name}"? This action cannot be undone and will delete all associated registrations, tickets, and data.`)) {
      return
    }

    setIsDeleting(true)
    try {
      await deleteEvent.mutateAsync(event.id)
      toast.success("Event deleted successfully")
      router.push("/events")
    } catch (error: any) {
      toast.error(error.message || "Failed to delete event")
      setIsDeleting(false)
    }
  }

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      await uploadDocument.mutateAsync({ eventCode, file })
      toast.success("Document uploaded successfully!")
    } catch {
      toast.error("Failed to upload document")
    }
  }

  const handleIndoorMapUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      await uploadIndoorMap.mutateAsync({ eventCode, file })
      toast.success("Indoor map uploaded successfully!")
    } catch {
      toast.error("Failed to upload indoor map")
    }
  }

  const handleTicketReply = async (ticketId: string) => {
    const answer = replyText[ticketId]
    if (!answer) return

    try {
      await replyToTicket.mutateAsync({ ticketId, answer })
      setReplyText((prev) => ({ ...prev, [ticketId]: "" }))
      toast.success("Reply sent successfully!")
    } catch {
      toast.error("Failed to send reply")
    }
  }

  const handleTicketFlag = async (ticketId: string) => {
    try {
      await updateTicketStatus.mutateAsync({ ticketId, status: "flagged" })
      toast.success("Ticket flagged for review")
    } catch {
      toast.error("Failed to flag ticket")
    }
  }

  const handleSendPoll = async () => {
    if (!event?.telegramChatId) {
      toast.error("No Telegram chat ID configured for this event")
      return
    }

    if (!pollQuestion || pollOptions.filter((o) => o.trim()).length < 2) {
      toast.error("Please provide a question and at least 2 options")
      return
    }

    try {
      await sendPoll.mutateAsync({
        chatId: event.telegramChatId,
        question: pollQuestion,
        options: pollOptions.filter((o) => o.trim()),
      })
      setPollQuestion("")
      setPollOptions(["", ""])
      toast.success("Poll sent successfully!")
    } catch {
      toast.error("Failed to send poll")
    }
  }

  if (eventLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  if (!event) {
    return (
      <DashboardLayout>
        <EmptyState
          icon={Calendar}
          title="Event not found"
          description="The event you're looking for doesn't exist or you don't have access to it."
          actionLabel="Back to Events"
          onAction={() => router.push("/events")}
        />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader title={event.name} description={`Event Code: ${event.code}`}>
          <Button variant="ghost" onClick={() => router.push("/events")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? "Deleting..." : "Delete Event"}
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(`/events/${event.code}`, "_blank")}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            View Public Page
          </Button>
        </PageHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="registrations">Registrations</TabsTrigger>
            <TabsTrigger value="poll">Poll</TabsTrigger>
            <TabsTrigger value="checkin">Check-In</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-6 md:grid-cols-2"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Event Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Event Code</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded bg-muted px-3 py-2 font-mono">
                        {event.code}
                      </code>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => copyToClipboard(event.code)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Description</Label>
                    <p className="text-sm">{event.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Date
                      </Label>
                      <p className="text-sm font-medium">
                        {(() => {
                          try {
                            return format(new Date(event.date), "PPP 'at' p")
                          } catch (e) {
                            return "Invalid Date"
                          }
                        })()}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Price
                      </Label>
                      <p className="text-sm font-medium">₹{event.ticketPrice}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <EventMap
                    lat={event.lat}
                    lng={event.lng}
                    address={event.address}
                    eventName={event.name}
                    height="250px"
                  />
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Address</Label>
                    <p className="text-sm">{event.address}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Latitude</Label>
                      <p className="text-sm font-mono">{event.lat}</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Longitude</Label>
                      <p className="text-sm font-mono">{event.lng}</p>
                    </div>
                  </div>
                  {event.telegramChatId && (
                    <div className="space-y-2">
                      <Label className="text-muted-foreground flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Telegram Chat ID
                      </Label>
                      <p className="text-sm font-mono">{event.telegramChatId}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-6 md:grid-cols-2"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Upload Document
                  </CardTitle>
                  <CardDescription>
                    Upload PDF, DOCX, or TXT files for the AI to answer questions from
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                    <Label
                      htmlFor="document-upload"
                      className="cursor-pointer text-primary hover:underline"
                    >
                      Click to upload or drag and drop
                    </Label>
                    <Input
                      id="document-upload"
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={handleDocumentUpload}
                      disabled={uploadDocument.isPending}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      PDF, DOCX, or TXT up to 10MB
                    </p>
                    {uploadDocument.isPending && (
                      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading...
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Indoor Map
                  </CardTitle>
                  <CardDescription>
                    Upload a floor plan image for attendee navigation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                    <Label
                      htmlFor="map-upload"
                      className="cursor-pointer text-primary hover:underline"
                    >
                      Click to upload or drag and drop
                    </Label>
                    <Input
                      id="map-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleIndoorMapUpload}
                      disabled={uploadIndoorMap.isPending}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      PNG, JPG, or WebP up to 5MB
                    </p>
                    {uploadIndoorMap.isPending && (
                      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading...
                      </div>
                    )}
                  </div>
                  {event.indoorMap?.url && (
                    <div className="mt-4">
                      <img
                        src={event.indoorMap.url}
                        alt="Indoor Map"
                        className="rounded-lg border w-full"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Tickets Tab */}
          <TabsContent value="tickets" className="mt-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Support Tickets
                  </CardTitle>
                  <CardDescription>
                    Manage questions from attendees via Telegram
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {ticketsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : tickets && tickets.length > 0 ? (
                    <div className="space-y-4">
                      {tickets.map((ticket: Ticket) => (
                        <div
                          key={ticket.id}
                          className="border rounded-lg p-4 space-y-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <p className="font-medium">{ticket.question}</p>
                              {ticket.autoAnswer && (
                                <div className="bg-muted rounded-md p-3 mt-2">
                                  <p className="text-xs text-muted-foreground mb-1">
                                    AI Auto-Answer:
                                  </p>
                                  <p className="text-sm">{ticket.autoAnswer}</p>
                                </div>
                              )}
                            </div>
                            <Badge
                              variant={
                                ticket.status === "answered"
                                  ? "default"
                                  : ticket.status === "flagged"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {ticket.status}
                            </Badge>
                          </div>

                          {ticket.answer && (
                            <div className="bg-primary/5 rounded-md p-3">
                              <p className="text-xs text-muted-foreground mb-1">
                                Your Reply:
                              </p>
                              <p className="text-sm">{ticket.answer}</p>
                            </div>
                          )}

                          {ticket.status === "open" && (
                            <div className="flex items-center gap-2">
                              <Input
                                placeholder="Type your reply..."
                                value={replyText[ticket.id] || ""}
                                onChange={(e) =>
                                  setReplyText((prev) => ({
                                    ...prev,
                                    [ticket.id]: e.target.value,
                                  }))
                                }
                              />
                              <Button
                                size="icon"
                                onClick={() => handleTicketReply(ticket.id)}
                                disabled={replyToTicket.isPending}
                              >
                                {replyToTicket.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => handleTicketFlag(ticket.id)}
                              >
                                <Flag className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={MessageSquare}
                      title="No tickets yet"
                      description="Support tickets from attendees will appear here"
                    />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Registrations Tab */}
          <TabsContent value="registrations" className="mt-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Registrations
                  </CardTitle>
                  <CardDescription>
                    View all registered attendees and their payment status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {registrationsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : registrations && registrations.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Payment Status</TableHead>
                          <TableHead>Registered</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {registrations.map((reg: Registration) => (
                          <TableRow key={reg.id}>
                            <TableCell className="font-medium">{reg.name}</TableCell>
                            <TableCell>{reg.email}</TableCell>
                            <TableCell>{reg.phone || "-"}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  reg.paymentStatus === "completed" || reg.paymentStatus === "paid"
                                    ? "default"
                                    : reg.paymentStatus === "pending"
                                      ? "secondary"
                                      : "destructive"
                                }
                              >
                                {reg.paymentStatus === "paid" ? "Paid" : reg.paymentStatus}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                try {
                                  return reg.createdAt ? format(new Date(reg.createdAt), "PP") : "N/A"
                                } catch (e) {
                                  return "Invalid Date"
                                }
                              })()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <EmptyState
                      icon={Users}
                      title="No registrations yet"
                      description="Attendee registrations will appear here"
                    />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Poll Tab */}
          <TabsContent value="poll" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-xl"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Send Telegram Poll
                  </CardTitle>
                  <CardDescription>
                    Create and send a poll to your event's Telegram group
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!event.telegramChatId ? (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-center">
                      <p className="text-sm text-destructive">
                        No Telegram Chat ID configured for this event. Please update
                        the event settings to enable polls.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="poll-question">Question</Label>
                        <Input
                          id="poll-question"
                          placeholder="What would you like to ask?"
                          value={pollQuestion}
                          onChange={(e) => setPollQuestion(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Options</Label>
                        {pollOptions.map((option, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input
                              placeholder={`Option ${index + 1}`}
                              value={option}
                              onChange={(e) => {
                                const newOptions = [...pollOptions]
                                newOptions[index] = e.target.value
                                setPollOptions(newOptions)
                              }}
                            />
                            {pollOptions.length > 2 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setPollOptions(
                                    pollOptions.filter((_, i) => i !== index)
                                  )
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {pollOptions.length < 10 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPollOptions([...pollOptions, ""])}
                          >
                            Add Option
                          </Button>
                        )}
                      </div>

                      <Button
                        className="w-full"
                        onClick={handleSendPoll}
                        disabled={sendPoll.isPending}
                      >
                        {sendPoll.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Send Poll
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Check-In Tab */}
          <TabsContent value="checkin" className="mt-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-6 md:grid-cols-2"
            >
              {/* QR Code for Event Registration */}
              <QRCodeGenerator
                data={`${typeof window !== 'undefined' ? window.location.origin : ''}/events/${event.code}`}
                title="Event Registration QR Code"
                size={256}
                showDownload={true}
                showShare={true}
              />

              {/* QR Code Scanner for Check-In */}
              <QRCodeScanner
                onScan={(data) => {
                  toast.success(`Scanned: ${data}`)
                  // TODO: Implement check-in logic
                  // You can add API call here to mark attendee as checked-in
                }}
                onError={(error) => {
                  toast.error(error)
                }}
                title="Scan Attendee QR Code"
                description="Scan attendee QR codes to check them in"
              />
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
