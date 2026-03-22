# Kapso sample messages

These are sample Kapso WhatsApp webhook request bodies consumed by `KapsoAdapter.handleWebhook()`. These payloads are illustrative; IDs, phone numbers, and URLs have been replaced with placeholders.

Unless noted otherwise, the corresponding request headers are typically:

```text
X-Webhook-Event: whatsapp.message.received
X-Webhook-Signature: <hmac-sha256-hex>
Content-Type: application/json
```

## Inbound text message

```json
{
  "message": {
    "id": "wamid.123",
    "from": "15551234567",
    "timestamp": "1730092800",
    "type": "text",
    "text": {
      "body": "Hello from Kapso"
    },
    "kapso": {
      "direction": "inbound",
      "status": "received",
      "processing_status": "pending",
      "origin": "cloud_api",
      "has_media": false,
      "content": "Hello from Kapso"
    }
  },
  "conversation": {
    "id": "conv_123",
    "phone_number": "+1 (555) 123-4567",
    "status": "active",
    "metadata": {},
    "phone_number_id": "123456789",
    "kapso": {
      "contact_name": "John Doe",
      "messages_count": 1,
      "last_message_id": "wamid.123",
      "last_message_type": "text",
      "last_message_timestamp": "2025-10-28T14:25:01Z",
      "last_message_text": "Hello from Kapso",
      "last_inbound_at": "2025-10-28T14:25:01Z",
      "last_outbound_at": null
    }
  },
  "is_new_conversation": true,
  "phone_number_id": "123456789"
}
```

## Inbound image/media message

```json
{
  "message": {
    "id": "wamid.789",
    "from": "15550001111",
    "timestamp": "1730093000",
    "type": "image",
    "image": {
      "id": "media_123",
      "caption": "Menu for today"
    },
    "kapso": {
      "direction": "inbound",
      "status": "received",
      "processing_status": "pending",
      "origin": "cloud_api",
      "has_media": true,
      "content": "Menu for today Image attached (menu.jpg) [Size: 200 KB | Type: image/jpeg] URL: https://api.kapso.ai/media/menu.jpg",
      "media_url": "https://api.kapso.ai/media/menu.jpg",
      "media_data": {
        "url": "https://api.kapso.ai/media/menu.jpg",
        "filename": "menu.jpg",
        "content_type": "image/jpeg",
        "byte_size": 204800
      },
      "message_type_data": {
        "caption": "Menu for today"
      }
    }
  },
  "conversation": {
    "id": "conv_456",
    "phone_number": "+1 (555) 000-1111",
    "status": "active",
    "metadata": {},
    "phone_number_id": "123456789",
    "kapso": {
      "contact_name": "Jane Doe",
      "messages_count": 8,
      "last_message_id": "wamid.789",
      "last_message_type": "image",
      "last_message_timestamp": "2025-10-28T14:30:00Z",
      "last_message_text": "Menu for today",
      "last_inbound_at": "2025-10-28T14:30:00Z",
      "last_outbound_at": "2025-10-28T14:20:00Z"
    }
  },
  "is_new_conversation": false,
  "phone_number_id": "123456789"
}
```

## Inbound reaction message

```json
{
  "message": {
    "id": "wamid.react.1",
    "from": "15551234567",
    "timestamp": "1730093400",
    "type": "reaction",
    "reaction": {
      "message_id": "wamid.outbound.1",
      "emoji": "👍"
    },
    "kapso": {
      "direction": "inbound",
      "status": "received",
      "processing_status": "pending",
      "origin": "cloud_api",
      "has_media": false,
      "content": "👍"
    }
  },
  "conversation": {
    "id": "conv_123",
    "phone_number": "+1 (555) 123-4567",
    "status": "active",
    "metadata": {},
    "phone_number_id": "123456789",
    "kapso": {
      "contact_name": "John Doe",
      "messages_count": 6,
      "last_message_id": "wamid.react.1",
      "last_message_type": "reaction",
      "last_message_timestamp": "2025-10-28T14:35:00Z",
      "last_message_text": "👍",
      "last_inbound_at": "2025-10-28T14:35:00Z",
      "last_outbound_at": "2025-10-28T14:34:30Z"
    }
  },
  "is_new_conversation": false,
  "phone_number_id": "123456789"
}
```

## Buffered webhook payload

Delivered with headers such as:

```text
X-Webhook-Event: whatsapp.message.received
X-Webhook-Batch: true
X-Batch-Size: 2
```

```json
{
  "batch": true,
  "data": [
    {
      "message": {
        "id": "wamid.batch.1",
        "from": "15551234567",
        "timestamp": "1730093500",
        "type": "text",
        "text": {
          "body": "First buffered message"
        },
        "kapso": {
          "direction": "inbound",
          "status": "received",
          "processing_status": "pending",
          "origin": "cloud_api",
          "has_media": false,
          "content": "First buffered message"
        }
      },
      "conversation": {
        "id": "conv_123",
        "phone_number": "+1 (555) 123-4567",
        "status": "active",
        "metadata": {},
        "phone_number_id": "123456789",
        "kapso": {
          "contact_name": "John Doe"
        }
      },
      "phone_number_id": "123456789"
    },
    {
      "message": {
        "id": "wamid.batch.2",
        "from": "15551234567",
        "timestamp": "1730093502",
        "type": "text",
        "text": {
          "body": "Second buffered message"
        },
        "kapso": {
          "direction": "inbound",
          "status": "received",
          "processing_status": "pending",
          "origin": "cloud_api",
          "has_media": false,
          "content": "Second buffered message"
        }
      },
      "conversation": {
        "id": "conv_123",
        "phone_number": "+1 (555) 123-4567",
        "status": "active",
        "metadata": {},
        "phone_number_id": "123456789",
        "kapso": {
          "contact_name": "John Doe"
        }
      },
      "phone_number_id": "123456789"
    }
  ]
}
```
