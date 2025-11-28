"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { motion } from "framer-motion"
import {
  Calendar,
  MapPin,
  DollarSign,
  Users,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  MessageSquare,
  Navigation,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { EventMap } from "@/components/features"
import { useEvent } from "@/hooks/use-events"
import { useCreateRegistration, useVerifyPayment } from "@/hooks/use-registrations"
import { toast } from "sonner"
import { format } from "date-fns"

declare global {
  interface Window {
    Razorpay: any
  }
}

export default function EventPublicPage() {
  const params = useParams()
  const eventCode = params.code as string

  const { data: event, isLoading } = useEvent(eventCode)
  const createRegistration = useCreateRegistration()
  const verifyPayment = useVerifyPayment()

  const [copied, setCopied] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [registrationOpen, setRegistrationOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  })

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.async = true
    document.body.appendChild(script)

    return () => {
      document.body.removeChild(script)
    }
  }, [])

  const copyEventCode = () => {
    navigator.clipboard.writeText(eventCode)
    setCopied(true)
    toast.success("Event code copied!")
    setTimeout(() => setCopied(false), 2000)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsRegistering(true)

    try {
      // Create registration and get Razorpay order
      const result = await createRegistration.mutateAsync({
        eventCode,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        amount: event?.ticketPrice || 0,
      })

      // Check if it's a free event
      if (result.isFree || (event?.ticketPrice || 0) <= 0) {
        toast.success("Registration successful! Check your email for confirmation.")
        setRegistrationOpen(false)
        setFormData({ name: "", email: "", phone: "" })
        return
      }

      // Initialize Razorpay payment for paid events
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: result.amount,
        currency: result.currency,
        name: event?.name || "Event Registration",
        description: `Registration for ${event?.name}`,
        order_id: result.orderId,
        handler: async (response: any) => {
          // Verify payment on backend
          try {
            await verifyPayment.mutateAsync({
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
              registrationId: result.registration.id,
            })
            toast.success("Registration successful! Check your email for confirmation.")
            setRegistrationOpen(false)
            setFormData({ name: "", email: "", phone: "" })
          } catch {
            toast.error("Payment verification failed. Please contact support.")
          }
        },
        prefill: {
          name: formData.name,
          email: formData.email,
          contact: formData.phone,
        },
        theme: {
          color: "#2563eb",
        },
      }

      const razorpay = new window.Razorpay(options)
      razorpay.open()
    } catch {
      toast.error("Failed to initiate registration")
    } finally {
      setIsRegistering(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Event Not Found</CardTitle>
            <CardDescription>
              The event you're looking for doesn't exist or has been removed.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const eventDate = new Date(event.date)
  const isUpcoming = eventDate > new Date()

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative bg-linear-to-b from-primary/10 to-background pb-12">
        <div className="container mx-auto px-4 pt-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto"
          >
            <div className="flex items-center gap-3 mb-4">
              <Badge variant={isUpcoming ? "default" : "secondary"}>
                {isUpcoming ? "Upcoming Event" : "Past Event"}
              </Badge>
              <button
                onClick={copyEventCode}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className="font-mono">{eventCode}</span>
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              {event.name}
            </h1>

            <p className="text-lg text-muted-foreground mb-8">
              {event.description}
            </p>

            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span>
                  {(() => {
                    try {
                      return format(new Date(event.date), "EEEE, MMMM d, yyyy 'at' h:mm a")
                    } catch (e) {
                      return "Date not available"
                    }
                  })()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <span>{event.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="font-semibold">₹{event.ticketPrice}</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Map */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Event Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <EventMap
                    lat={event.lat}
                    lng={event.lng}
                    address={event.address}
                    eventName={event.name}
                    height="300px"
                  />
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{event.address}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(
                          `https://www.google.com/maps/dir/?api=1&destination=${event.lat},${event.lng}`,
                          "_blank"
                        )
                      }
                    >
                      <Navigation className="mr-2 h-4 w-4" />
                      Get Directions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Indoor Map */}
            {event.indoorMap?.url && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Indoor Map</CardTitle>
                    <CardDescription>
                      Navigate the venue with our indoor floor plan
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative">
                      <img
                        src={event.indoorMap.url}
                        alt="Indoor Map"
                        className="w-full rounded-lg"
                      />
                      {event.indoorMap.pois?.map((poi) => (
                        <div
                          key={poi.id}
                          className="absolute w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold shadow-lg cursor-pointer transform -translate-x-1/2 -translate-y-1/2 hover:scale-110 transition-transform"
                          style={{ left: `${poi.x}%`, top: `${poi.y}%` }}
                          title={poi.name}
                        >
                          {poi.name.charAt(0)}
                        </div>
                      ))}
                    </div>
                    {event.indoorMap.pois && event.indoorMap.pois.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {event.indoorMap.pois.map((poi) => (
                          <Badge key={poi.id} variant="secondary">
                            {poi.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Registration Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle>Register Now</CardTitle>
                  <CardDescription>
                    Secure your spot at this event
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Ticket Price</span>
                    <span className="text-2xl font-bold">
                      {(event.ticketPrice || 0) > 0 ? `₹${event.ticketPrice}` : "Free"}
                    </span>
                  </div>

                  <Separator />

                  {isUpcoming ? (
                    <Dialog open={registrationOpen} onOpenChange={setRegistrationOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full" size="lg">
                          <Users className="mr-2 h-4 w-4" />
                          Register for Event
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Register for {event.name}</DialogTitle>
                          <DialogDescription>
                            Fill in your details to complete registration
                          </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleRegistration} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                              id="name"
                              name="name"
                              placeholder="Enter your full name"
                              value={formData.name}
                              onChange={handleInputChange}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                              id="email"
                              name="email"
                              type="email"
                              placeholder="Enter your email"
                              value={formData.email}
                              onChange={handleInputChange}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input
                              id="phone"
                              name="phone"
                              type="tel"
                              placeholder="Enter your phone number"
                              value={formData.phone}
                              onChange={handleInputChange}
                              required
                            />
                          </div>

                          <Separator />

                          <div className="flex items-center justify-between text-sm">
                            <span>Total Amount</span>
                            <span className="font-bold">
                              {(event?.ticketPrice || 0) > 0 ? `₹${event?.ticketPrice}` : "Free"}
                            </span>
                          </div>

                          <Button
                            type="submit"
                            className="w-full"
                            disabled={isRegistering}
                          >
                            {isRegistering ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                              </>
                            ) : (event?.ticketPrice || 0) > 0 ? (
                              <>Pay ₹{event?.ticketPrice} & Register</>
                            ) : (
                              <>Register for Free</>
                            )}
                          </Button>
                        </form>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <div className="text-center py-4">
                      <Badge variant="secondary" className="mb-2">
                        Event Ended
                      </Badge>
                      <p className="text-sm text-muted-foreground">
                        Registration is closed for this event
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Telegram Support Card */}
            {event.telegramChatId && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Need Help?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Join our Telegram group for event updates and to ask questions
                      to our AI-powered support bot.
                    </p>
                    <div className="bg-muted rounded-lg p-4 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        How to get support:
                      </p>
                      <ol className="text-sm space-y-1 list-decimal list-inside">
                        <li>Join our Telegram group</li>
                        <li>
                          Send your question with event code:{" "}
                          <code className="bg-background px-1 rounded">
                            {eventCode}
                          </code>
                        </li>
                        <li>Get instant AI-powered answers!</li>
                      </ol>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
