package com.httpsms

import android.content.Context
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.apache.commons.text.StringEscapeUtils
import timber.log.Timber
import java.net.URI
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.logging.Level
import java.util.logging.Logger.getLogger


class HttpSmsApiService(private val apiKey: String, private val baseURL: URI) {
    private val apiKeyHeader = "x-api-key"
    private val clientVersionHeader = "X-Client-Version"
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private val client = OkHttpClient.Builder().retryOnConnectionFailure(true).build()

    init {
        getLogger(OkHttpClient::class.java.name).level = Level.FINE
    }

    companion object {
        fun create(context: Context): HttpSmsApiService {
            return HttpSmsApiService(
                Settings.getApiKeyOrDefault(context),
                Settings.getServerUrlOrDefault(context)
            )
        }
    }

    fun getOutstandingMessage(messageID: String): Message? {
        val request: Request = Request.Builder()
            .url(baseURL.resolve("/v1/messages/outstanding?message_id=${messageID}").toURL())
            .header(apiKeyHeader, apiKey)
            .header(clientVersionHeader, BuildConfig.VERSION_NAME)
            .build()

        val response = client.newCall(request).execute()
        if (response.isSuccessful) {
            val payload = ResponseMessage.fromJson(response.body!!.string())?.data
            if (payload == null) {
                Timber.e("cannot decode payload [${response.body}]")
                return null
            }
            Timber.w("response code [${response.code}]")
            response.close()
            return payload
        }

        Timber.e("invalid response with code [${response.code}]")
        response.close()
        return null
    }

    fun sendDeliveredEvent(messageId: String, timestamp: ZonedDateTime) {
        sendEvent(messageId, "DELIVERED", timestamp)
    }

    fun sendSentEvent(messageId: String, timestamp: ZonedDateTime) {
        sendEvent(messageId, "SENT", timestamp)
    }

    fun sendFailedEvent(messageId: String, timestamp: ZonedDateTime, reason: String) {
        sendEvent(messageId, "FAILED", timestamp, reason)
    }

    fun receive(from: String, to: String, content: String, timestamp: ZonedDateTime) {
        val formatter  = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'000000'ZZZZZ")
        val timestampString = formatter.format(timestamp).replace("+", "Z")


        val body = """
            {
              "content": "${StringEscapeUtils.escapeJson(content)}",
              "from": "$from",
              "timestamp": "$timestampString",
              "to": "$to"
            }
        """.trimIndent()

        val request: Request = Request.Builder()
            .url(baseURL.resolve("/v1/messages/receive").toURL())
            .post(body.toRequestBody(jsonMediaType))
            .header(apiKeyHeader, apiKey)
            .header(clientVersionHeader, BuildConfig.VERSION_NAME)
            .build()

        val response = client.newCall(request).execute()
        if (!response.isSuccessful) {
            Timber.e("error response [${response.body?.string()}] with code [${response.code}] while receiving message [${body}]")
            return
        }

        val message = ResponseMessage.fromJson(response.body!!.string())
        response.close()
        Timber.i("received message stored successfully for message with ID [${message?.data?.id}]" )
    }

    fun storeHeartbeat(phoneNumber: String) {
        val body = """
            {
              "owner": "$phoneNumber"
            }
        """.trimIndent()

        val request: Request = Request.Builder()
            .url(baseURL.resolve("/v1/heartbeats").toURL())
            .post(body.toRequestBody(jsonMediaType))
            .header(apiKeyHeader, apiKey)
            .header(clientVersionHeader, BuildConfig.VERSION_NAME)
            .build()

        val response = client.newCall(request).execute()
        if (!response.isSuccessful) {
            Timber.e("error response [${response.body?.string()}] with code [${response.code}] while sending heartbeat [$body] for owner [$phoneNumber]")
            return
        }

        response.close()
        Timber.i( "heartbeat stored successfully for owner [$phoneNumber]" )
    }


    private fun sendEvent(messageId: String, event: String, timestamp: ZonedDateTime, reason: String? = null) {
        val formatter  = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'000000'ZZZZZ")
        val timestampString = formatter.format(timestamp).replace("+", "Z")

        var reasonString = "null"
        if (reason != null) {
            reasonString = "\"$reason\""
        }

        val body = """
            {
              "event_name": "$event",
              "reason": $reasonString,
              "timestamp": "$timestampString"
            }
        """.trimIndent()

        val request: Request = Request.Builder()
            .url(baseURL.resolve("/v1/messages/${messageId}/events").toURL())
            .post(body.toRequestBody(jsonMediaType))
            .header(apiKeyHeader, apiKey)
            .header(clientVersionHeader, BuildConfig.VERSION_NAME)
            .build()

        val response = client.newCall(request).execute()
        if (!response.isSuccessful) {
           Timber.e("error response [${response.body?.string()}] with code [${response.code}] while sending [${event}] event [${body}] for message with ID [${messageId}]")
            return
        }

        response.close()
        Timber.i( "[$event] event sent successfully for message with ID [$messageId]" )
    }


    fun updatePhone(phoneNumber: String, fcmToken: String, isDualSIM: Boolean): Boolean {
        val body = """
            {
              "fcm_token": "$fcmToken",
              "phone_number": "$phoneNumber",
              "is_dual_sim": $isDualSIM
            }
        """.trimIndent()

        val request: Request = Request.Builder()
            .url(baseURL.resolve("/v1/phones").toURL())
            .put(body.toRequestBody(jsonMediaType))
            .header(apiKeyHeader, apiKey)
            .header(clientVersionHeader, BuildConfig.VERSION_NAME)
            .build()

        val response = client.newCall(request).execute()
        if (!response.isSuccessful) {
            Timber.e("error response [${response.body?.string()}] with code [${response.code}] while sending fcm token [${body}]")
            return false
        }

        response.close()
        Timber.i("fcm token sent successfully for phone [$phoneNumber]" )
        return  true
    }


    fun validateApiKey(): Pair<String?, String?> {
        val request: Request = Request.Builder()
            .url(baseURL.resolve("/v1/users/me").toURL())
            .header(apiKeyHeader, apiKey)
            .header(clientVersionHeader, BuildConfig.VERSION_NAME)
            .get()
            .build()

        try {
            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                Timber.e("error response [${response.body?.string()}] with code [${response.code}] while verifying apiKey [$apiKey]")
                return Pair("Cannot validate the API key. Check if it is correct and try again.", null)
            }

            response.close()
            Timber.i("api key [$apiKey] and server url [$baseURL] are valid" )
            return Pair(null, null)
        } catch (ex: Exception) {
            return Pair(null, ex.message)
        }
    }
}
