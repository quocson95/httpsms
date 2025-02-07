package services

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/NdoleStudio/httpsms/pkg/events"
	"github.com/NdoleStudio/httpsms/pkg/repositories"
	"github.com/NdoleStudio/httpsms/pkg/telemetry"
	cloudevents "github.com/cloudevents/sdk-go/v2"
	"github.com/palantir/stacktrace"
)

// EventDispatcher dispatches a new event
type EventDispatcher struct {
	logger      telemetry.Logger
	tracer      telemetry.Tracer
	repository  repositories.EventRepository
	listeners   map[string][]events.EventListener
	queue       PushQueue
	queueConfig PushQueueConfig
}

// NewEventDispatcher creates a new EventDispatcher
func NewEventDispatcher(
	logger telemetry.Logger,
	tracer telemetry.Tracer,
	repository repositories.EventRepository,
	queue PushQueue,
	queueConfig PushQueueConfig,
) (dispatcher *EventDispatcher) {
	return &EventDispatcher{
		logger:      logger,
		tracer:      tracer,
		listeners:   make(map[string][]events.EventListener),
		repository:  repository,
		queue:       queue,
		queueConfig: queueConfig,
	}
}

// DispatchSync dispatches a new event
func (dispatcher *EventDispatcher) DispatchSync(ctx context.Context, event cloudevents.Event) error {
	ctx, span := dispatcher.tracer.Start(ctx)
	defer span.End()

	if err := event.Validate(); err != nil {
		msg := fmt.Sprintf("cannot dispatch event with ID [%s] and type [%s] because it is invalid", event.ID(), event.Type())
		return dispatcher.tracer.WrapErrorSpan(span, stacktrace.Propagate(err, msg))
	}

	if err := dispatcher.repository.Create(ctx, event); err != nil {
		msg := fmt.Sprintf("cannot save event with ID [%s] and type [%s]", event.ID(), event.Type())
		return dispatcher.tracer.WrapErrorSpan(span, stacktrace.Propagate(err, msg))
	}

	dispatcher.Publish(ctx, event)
	return nil
}

// DispatchWithTimeout dispatches an event with a timeout
func (dispatcher *EventDispatcher) DispatchWithTimeout(ctx context.Context, event cloudevents.Event, timeout time.Duration) (queueID string, err error) {
	ctx, span := dispatcher.tracer.Start(ctx)
	defer span.End()

	if err := event.Validate(); err != nil {
		msg := fmt.Sprintf("cannot dispatch event with ID [%s] and type [%s] because it is invalid", event.ID(), event.Type())
		return queueID, dispatcher.tracer.WrapErrorSpan(span, stacktrace.Propagate(err, msg))
	}

	task, err := dispatcher.createCloudTask(event)
	if err != nil {
		msg := fmt.Sprintf("cannot create cloud task for event [%s] with id [%s]", event.Type(), event.ID())
		return queueID, dispatcher.tracer.WrapErrorSpan(span, stacktrace.Propagate(err, msg))
	}

	if queueID, err = dispatcher.queue.Enqueue(ctx, task, timeout); err != nil {
		msg := fmt.Sprintf("cannot enqueue event with ID [%s] and type [%s]", event.ID(), event.Type())
		return queueID, dispatcher.tracer.WrapErrorSpan(span, stacktrace.Propagate(err, msg))
	}

	return queueID, nil
}

// Dispatch a new event by adding it to the queue to be processed async
func (dispatcher *EventDispatcher) Dispatch(ctx context.Context, event cloudevents.Event) error {
	ctx, span := dispatcher.tracer.Start(ctx)
	defer span.End()
	_, err := dispatcher.DispatchWithTimeout(ctx, event, time.Nanosecond*1)
	return err
}

// Subscribe a listener to an event
func (dispatcher *EventDispatcher) Subscribe(eventType string, listener events.EventListener) {
	if _, ok := dispatcher.listeners[eventType]; !ok {
		dispatcher.listeners[eventType] = []events.EventListener{}
	}

	dispatcher.listeners[eventType] = append(dispatcher.listeners[eventType], listener)
}

// Publish an event to subscribers
func (dispatcher *EventDispatcher) Publish(ctx context.Context, event cloudevents.Event) {
	ctx, span := dispatcher.tracer.Start(ctx)
	defer span.End()

	ctxLogger := dispatcher.tracer.CtxLogger(dispatcher.logger, span)

	subscribers, ok := dispatcher.listeners[event.Type()]
	if !ok {
		ctxLogger.Info(fmt.Sprintf("no listener is configured for event type [%s]", event.Type()))
		return
	}

	var wg sync.WaitGroup
	for _, sub := range subscribers {
		wg.Add(1)
		go func(ctx context.Context, sub events.EventListener) {
			if err := sub(ctx, event); err != nil {
				msg := fmt.Sprintf("subscriber [%T] cannot handle event [%s]", sub, event.Type())
				ctxLogger.Error(stacktrace.Propagate(err, msg))
			}
			wg.Done()
		}(ctx, sub)
	}

	wg.Wait()
}

func (dispatcher *EventDispatcher) createCloudTask(event cloudevents.Event) (*PushQueueTask, error) {
	eventContent, err := json.Marshal(event)
	if err != nil {
		return nil, stacktrace.Propagate(err, fmt.Sprintf("cannot marshall [%T] with ID [%s]", event, event.ID()))
	}

	return &PushQueueTask{
		Method: http.MethodPost,
		URL:    dispatcher.queueConfig.ConsumerEndpoint,
		Body:   eventContent,
		Headers: map[string]string{
			"x-api-key": dispatcher.queueConfig.UserAPIKey,
		},
	}, nil
}
