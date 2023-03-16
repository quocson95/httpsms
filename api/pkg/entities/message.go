package entities

import (
	"time"

	"github.com/google/uuid"
)

// MessageType is the type of message if it is incoming or outgoing
type MessageType string

const (
	// MessageTypeMobileTerminated means the message it sent to a mobile phone
	MessageTypeMobileTerminated = "mobile-terminated"

	// MessageTypeMobileOriginated means the message comes directly from a mobile phone
	MessageTypeMobileOriginated = "mobile-originated"
)

// MessageStatus is the status of the message
type MessageStatus string

const (
	// MessageStatusPending means the message has been queued to be sent
	MessageStatusPending = "pending"

	// MessageStatusScheduled means the message has been scheduled to be sent
	MessageStatusScheduled = "scheduled"

	// MessageStatusSending means a phone has picked up the message and is currently sending it
	MessageStatusSending = "sending"

	// MessageStatusSent means the message has already sent by the mobile phone
	MessageStatusSent = "sent"

	// MessageStatusReceived means the message was received by tne mobile phone (MO)
	MessageStatusReceived = "received"

	// MessageStatusFailed means the mobile phone could not send the message
	MessageStatusFailed = "failed"

	// MessageStatusDelivered means the mobile phone has delivered the message
	MessageStatusDelivered = "delivered"

	// MessageStatusExpired means the message could not be sent by the mobile phone after 5 minutes
	MessageStatusExpired = "expired"
)

// MessageEventName is the type of event generated by the mobile phone for a message
type MessageEventName string

const (
	// MessageEventNameSent is emitted when a message is sent by the mobile phone
	MessageEventNameSent = MessageEventName("SENT")

	// MessageEventNameDelivered is emitted when a message is delivered by the mobile phone
	MessageEventNameDelivered = MessageEventName("DELIVERED")

	// MessageEventNameFailed is emitted when a message is failed by the mobile phone
	MessageEventNameFailed = MessageEventName("FAILED")
)

type SIM string

const (
	// ISMS_1 use the SIM card in slot 1 to send the message
	ISMS_1 = SIM("ISMS")
	// ISMS_2 use the SIM card in slot 2 to send the message
	ISMS_2 = SIM("ISMS2")
	// DEFAULT use the SIM card configured as default communication card to send the message
	ISMS_DEFAULT = SIM("DEFAULT")
)

// Message represents a message sent between 2 phone numbers
type Message struct {
	ID      uuid.UUID     `json:"id" gorm:"primaryKey;type:uuid;" example:"32343a19-da5e-4b1b-a767-3298a73703cb"`
	Owner   string        `json:"owner" gorm:"index:idx_messages_user_id__owner__contact" example:"+18005550199"`
	UserID  UserID        `json:"user_id" gorm:"index:idx_messages_user_id__owner__contact" example:"WB7DRDWrJZRGbYrv2CKGkqbzvqdC"`
	Contact string        `json:"contact" gorm:"index:idx_messages_user_id__owner__contact" example:"+18005550100"`
	Content string        `json:"content" example:"This is a sample text message"`
	Type    MessageType   `json:"type" example:"mobile-terminated"`
	Status  MessageStatus `json:"status" gorm:"index:idx_messages_status" example:"pending"`
	// SIM is the type of event
	// * ISMS: use the SIM card in slot 1
	// * ISMS2: use the SIM card in slot 2
	// * DEFAULT: used the default communication SIM card
	SIM SIM `json:"sim" example:"DEFAULT"`

	// SendDuration is the number of nanoseconds from when the request was received until when the mobile phone send the message
	SendDuration *int64 `json:"send_time" example:"133414"`

	RequestReceivedAt       time.Time  `json:"request_received_at" example:"2022-06-05T14:26:01.520828+03:00"`
	CreatedAt               time.Time  `json:"created_at" example:"2022-06-05T14:26:02.302718+03:00"`
	UpdatedAt               time.Time  `json:"updated_at" example:"2022-06-05T14:26:10.303278+03:00"`
	OrderTimestamp          time.Time  `json:"order_timestamp" gorm:"index:idx_messages_order_timestamp" example:"2022-06-05T14:26:09.527976+03:00"`
	LastAttemptedAt         *time.Time `json:"last_attempted_at" example:"2022-06-05T14:26:09.527976+03:00"`
	NotificationScheduledAt *time.Time `json:"scheduled_at" example:"2022-06-05T14:26:09.527976+03:00"`
	SentAt                  *time.Time `json:"sent_at" example:"2022-06-05T14:26:09.527976+03:00"`
	DeliveredAt             *time.Time `json:"delivered_at" example:"2022-06-05T14:26:09.527976+03:00"`
	ExpiredAt               *time.Time `json:"expired_at" example:"2022-06-05T14:26:09.527976+03:00"`
	FailedAt                *time.Time `json:"failed_at" example:"2022-06-05T14:26:09.527976+03:00"`
	CanBePolled             bool       `json:"can_be_polled" example:"false"`
	SendAttemptCount        uint       `json:"send_attempt_count" example:"0"`
	MaxSendAttempts         uint       `json:"max_send_attempts" example:"1"`
	ReceivedAt              *time.Time `json:"received_at" example:"2022-06-05T14:26:09.527976+03:00"`
	FailureReason           *string    `json:"failure_reason" example:"UNKNOWN"`
}

// IsSending determines if a message is being sent
func (message *Message) IsSending() bool {
	return message.Status == MessageStatusSending
}

// IsDelivered checks if a message is delivered
func (message *Message) IsDelivered() bool {
	return message.Status == MessageStatusDelivered
}

// IsPending checks if a message is pending
func (message *Message) IsPending() bool {
	return message.Status == MessageStatusPending
}

// IsScheduled checks if a message is scheduled
func (message *Message) IsScheduled() bool {
	return message.Status == MessageStatusScheduled
}

// IsExpired checks if a message is expired
func (message *Message) IsExpired() bool {
	return message.Status == MessageStatusExpired
}

// CanBeRescheduled checks if a message can be rescheduled
func (message *Message) CanBeRescheduled() bool {
	return message.SendAttemptCount < message.MaxSendAttempts
}

// IsSent determines if a message has been sent
func (message *Message) IsSent() bool {
	return message.Status == MessageStatusSent
}

// Sent registers a message as sent
func (message *Message) Sent(timestamp time.Time) *Message {
	sendDuration := timestamp.UnixNano() - message.RequestReceivedAt.UnixNano()
	message.SentAt = &timestamp
	message.Status = MessageStatusSent
	message.updateOrderTimestamp(timestamp)
	message.SendDuration = &sendDuration

	return message
}

// Failed registers a message as failed
func (message *Message) Failed(timestamp time.Time, errorMessage string) *Message {
	message.FailedAt = &timestamp
	message.Status = MessageStatusFailed
	message.FailureReason = &errorMessage
	message.updateOrderTimestamp(timestamp)
	return message
}

// Delivered registers a message as delivered
func (message *Message) Delivered(timestamp time.Time) *Message {
	message.DeliveredAt = &timestamp
	message.Status = MessageStatusDelivered
	if message.SendDuration == nil {
		sendDuration := timestamp.UnixNano() - message.RequestReceivedAt.UnixNano()
		message.SendDuration = &sendDuration

	}
	message.updateOrderTimestamp(timestamp)
	return message
}

// AddSendAttemptCount increments the send attempt count of a message
func (message *Message) AddSendAttemptCount() *Message {
	message.SendAttemptCount++
	return message
}

// Expired registers a message as expired
func (message *Message) Expired(timestamp time.Time) *Message {
	message.ExpiredAt = &timestamp
	message.Status = MessageStatusExpired
	message.CanBePolled = true
	message.updateOrderTimestamp(timestamp)
	return message
}

// NotificationScheduled registers a message as scheduled
func (message *Message) NotificationScheduled(timestamp time.Time) *Message {
	message.NotificationScheduledAt = &timestamp

	if message.IsExpired() || message.IsPending() {
		message.Status = MessageStatusScheduled
	}
	message.updateOrderTimestamp(timestamp)

	return message
}

// AddSendAttempt configures a Message for sending
func (message *Message) AddSendAttempt(timestamp time.Time) *Message {
	message.Status = MessageStatusSending
	message.LastAttemptedAt = &timestamp
	message.updateOrderTimestamp(timestamp)
	return message
}

func (message *Message) updateOrderTimestamp(timestamp time.Time) {
	if timestamp.UnixNano() > message.OrderTimestamp.UnixNano() {
		message.OrderTimestamp = timestamp
	}
}
