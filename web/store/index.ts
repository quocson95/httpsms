import { ActionContext } from 'vuex'
import { AxiosError, AxiosResponse } from 'axios'
import { MessageThread } from '~/models/message-thread'
import { Message } from '~/models/message'
import { Heartbeat } from '~/models/heartbeat'
import axios, { setApiKey, setAuthHeader } from '~/plugins/axios'
import { Phone } from '~/models/phone'
import { User } from '~/models/user'
import { BillingUsage } from '~/models/billing'
import {
  EntitiesDiscord,
  EntitiesWebhook,
  RequestsDiscordStore,
  RequestsDiscordUpdate,
  RequestsWebhookStore,
  RequestsWebhookUpdate,
  ResponsesDiscordResponse,
  ResponsesDiscordsResponse,
  ResponsesNoContent,
  ResponsesOkString,
  ResponsesWebhookResponse,
  ResponsesWebhooksResponse,
} from '~/models/api'
import { getErrorMessages } from '~/plugins/errors'

const defaultNotificationTimeout = 3000

type NotificationType = 'error' | 'success' | 'info'

export interface Notification {
  message: string
  timeout: number
  active: boolean
  type: NotificationType
}

export interface NotificationRequest {
  message: string
  type: NotificationType
}

export type AuthUser = {
  email: string | null
  displayName: string | null
  id: string
}

export type State = {
  owner: string | null
  axiosError: AxiosError | null
  loadingThreads: boolean
  archivedThreads: boolean
  authStateChanged: boolean
  authUser: AuthUser | null
  billingUsage: BillingUsage | null
  billingUsageHistory: Array<BillingUsage>
  user: User | null
  phones: Array<Phone>
  threads: Array<MessageThread>
  threadId: string | null
  heartbeat: null | Heartbeat
  pooling: boolean
  notification: Notification
}

export const state = (): State => ({
  threads: [],
  threadId: null,
  heartbeat: null,
  axiosError: null,
  authStateChanged: false,
  loadingThreads: true,
  billingUsage: null,
  billingUsageHistory: [],
  archivedThreads: false,
  pooling: false,
  phones: [],
  user: null,
  owner: null,
  authUser: null,
  notification: {
    active: false,
    message: '',
    type: 'success',
    timeout: defaultNotificationTimeout,
  },
})

export type AppData = {
  url: string
  name: string
  env: string
  appDownloadUrl: string
  documentationUrl: string
  githubUrl: string
}

export const getters = {
  getThreads(state: State): Array<MessageThread> {
    return state.threads
  },

  getAppData(): AppData {
    let url = process.env.APP_URL as string
    if (url.length > 0 && url[url.length - 1] === '/') {
      url = url.substring(0, url.length - 1)
    }
    return {
      url,
      env: process.env.APP_ENV as string,
      appDownloadUrl: process.env.APP_DOWNLOAD_URL as string,
      documentationUrl: process.env.APP_DOCUMENTATION_URL as string,
      githubUrl: process.env.APP_GITHUB_URL as string,
      name: process.env.APP_NAME as string,
    }
  },

  hasThreadId: (state: State) => (threadId: string) => {
    return state.threads.find((x) => x.id === threadId) !== undefined
  },

  getAuthUser(state: State): AuthUser | null {
    return state.authUser
  },

  getAxiosError(state: State): AxiosError | null {
    return state.axiosError
  },

  authStateChanged: (state: State) => state.authStateChanged,

  isLocal(): boolean {
    return process.env.APP_ENV === 'local'
  },

  getUser(state: State): User | null {
    return state.user
  },

  getBillingUsageHistory(state: State): Array<BillingUsage> {
    return state.billingUsageHistory
  },

  getBillingUsage(state: State): BillingUsage | null {
    return state.billingUsage
  },

  getOwner(state: State): string | null {
    return state.owner
  },

  getActivePhone(state: State): Phone | null {
    return (
      state.phones.find((x: Phone) => {
        return x.phone_number === state.owner
      }) ?? null
    )
  },

  getPhones(state: State): Array<Phone> {
    return state.phones
  },

  hasThread(state: State): boolean {
    return state.threadId != null && !state.loadingThreads
  },

  getLoadingThreads(state: State): boolean {
    return state.loadingThreads
  },

  getThread(state: State): MessageThread {
    const thread = state.threads.find((x) => x.id === state.threadId)
    if (thread === undefined) {
      throw new Error(`cannot find thread with id ${state.threadId}`)
    }
    return thread
  },

  getHeartbeat(state: State): Heartbeat | null {
    return state.heartbeat
  },

  getPolling(state: State): boolean {
    return state.pooling
  },

  getIsArchived(state: State): boolean {
    return state.archivedThreads
  },

  getNotification(state: State): Notification {
    return state.notification
  },
}

export const mutations = {
  setThreads(state: State, payload: Array<MessageThread>) {
    state.threads = [...payload]
    state.loadingThreads = false
  },
  setThreadId(state: State, payload: string | null) {
    state.threadId = payload
  },
  setBillingUsageHistory(state: State, payload: Array<BillingUsage>) {
    state.billingUsageHistory = payload
  },
  setBillingUsage(state: State, payload: BillingUsage | null) {
    state.billingUsage = payload
  },
  setHeartbeat(state: State, payload: Heartbeat | null) {
    state.heartbeat = payload
  },
  setPooling(state: State, payload: boolean) {
    state.pooling = payload
  },
  setAuthUser(state: State, payload: AuthUser | null) {
    state.authStateChanged = true
    state.authUser = payload
  },
  setAxiosError(state: State, payload: AxiosError | null) {
    state.axiosError = payload
  },
  setNotification(state: State, notification: NotificationRequest) {
    state.notification = {
      ...state.notification,
      active: true,
      message: notification.message,
      type: notification.type,
      timeout: Math.floor(Math.random() * 100) + defaultNotificationTimeout, // Reset the timeout
    }
  },
  disableNotification(state: State) {
    state.notification.active = false
  },
  setPhones(state: State, payload: Array<Phone>) {
    state.phones = payload

    const owner = payload.find((x) => x.phone_number === state.owner)
    if (!owner && state.phones.length > 0) {
      state.owner = state.phones[0].phone_number
    }
  },
  setUser(state: State, payload: User | null) {
    state.user = payload
  },

  setOwner(state: State, payload: string) {
    state.owner = payload
    state.loadingThreads = true
  },

  setArchivedThreads(state: State, payload: boolean) {
    state.archivedThreads = payload
  },

  setLoadingThreads(state: State, payload: boolean) {
    state.loadingThreads = payload
  },

  resetState(state: State) {
    state.threads = []
    state.billingUsage = null
    state.billingUsageHistory = []
    state.phones = []
    state.user = null
    state.threadId = null
    state.archivedThreads = false
    state.owner = null
    setApiKey('')
  },
}

export type SIM = 'SIM1' | 'SIM2' | 'DEFAULT'

export type SendMessageRequest = {
  from: string
  to: string
  content: string
  sim: SIM
}

export const actions = {
  async loadThreads(context: ActionContext<State, State>) {
    if (
      context.getters.getOwner === null &&
      context.getters.getPhones.length === 0
    ) {
      context.commit('setLoadingThreads', false)
      return
    }

    const response = await axios.get('/v1/message-threads', {
      params: {
        owner:
          context.getters.getOwner ?? context.getters.getPhones[0].phone_number,
        limit: 100,
        is_archived: context.getters.getIsArchived,
      },
    })

    await context.dispatch('getHeartbeat')
    await context.commit('setThreads', response.data.data)
  },

  async loadBillingUsage(context: ActionContext<State, State>) {
    const response = await axios.get('/v1/billing/usage')
    await context.commit('setBillingUsage', response.data.data)
  },

  async loadBillingUsageHistory(context: ActionContext<State, State>) {
    const response = await axios.get('/v1/billing/usage-history')
    await context.commit('setBillingUsageHistory', response.data.data)
  },

  async toggleArchive(context: ActionContext<State, State>) {
    await context.commit('setArchivedThreads', !context.getters.getIsArchived)
  },

  async loadPhones(context: ActionContext<State, State>, force: boolean) {
    if (context.getters.getPhones.length > 0 && !force) {
      return
    }

    const response = await axios.get('/v1/phones', { params: { limit: 100 } })
    context.commit('setPhones', response.data.data)

    if (context.state.user && context.state.user.active_phone_id) {
      const phone = response.data.data.find(
        (x: Phone) => x.id === context.state.user?.active_phone_id
      )
      if (phone) {
        context.commit('setOwner', phone.phone_number)
      }
    }
  },

  async loadUser(context: ActionContext<State, State>) {
    const response = await axios.get('/v1/users/me')
    context.commit('setUser', response.data.data)
  },

  async deletePhone(context: ActionContext<State, State>, phoneID: string) {
    await axios.delete(`/v1/phones/${phoneID}`)
    await context.dispatch('loadPhones', true)
  },

  resetState(context: ActionContext<State, State>) {
    context.commit('resetState', false)
  },

  async updatePhone(context: ActionContext<State, State>, phone: Phone) {
    await axios
      .put(`/v1/phones`, {
        fcm_token: phone.fcm_token,
        phone_number: phone.phone_number,
        message_expiration_seconds: parseInt(
          phone.message_expiration_seconds.toString()
        ),
        max_send_attempts: parseInt(phone.max_send_attempts.toString()),
        messages_per_minute: parseInt(phone.messages_per_minute.toString()),
      })
      .catch((error: AxiosError) => {
        context.dispatch('handleAxiosError', error)
      })
      .then((response: any) => {
        context.dispatch('addNotification', {
          message: response.data.message,
          type: 'success',
        })
      })

    await context.dispatch('loadPhones', true)
  },

  async handleAxiosError(
    context: ActionContext<State, State>,
    error: AxiosError
  ) {
    const errorMessage =
      error.response?.data?.data[Object.keys(error.response?.data?.data)[0]][0]
    await context.dispatch('addNotification', {
      message:
        (errorMessage ? errorMessage.replaceAll('_', ' ') : null) ??
        error.response?.data.message,
      type: 'error',
    })
    await context.commit('setAxiosError', error)
  },

  getHeartbeat(
    context: ActionContext<State, State>,
    limit = 1
  ): Promise<Array<Heartbeat>> {
    return new Promise<Array<Heartbeat>>((resolve, reject) => {
      axios
        .get('/v1/heartbeats', {
          params: {
            limit,
            owner: context.getters.getOwner,
          },
        })
        .then((response: AxiosResponse) => {
          if (response.data.data.length > 0) {
            context.commit('setHeartbeat', response.data.data[0])
          } else {
            context.commit('setHeartbeat', null)
          }
          resolve(response.data.data)
        })
        .catch(async (error: AxiosError) => {
          await context.dispatch('addNotification', {
            message:
              error.response?.data?.message ??
              'Errors while fetching heartbeat',
            type: 'error',
          })
          reject(error)
        })
    })
  },

  setPolling(context: ActionContext<State, State>, status: boolean) {
    context.commit('setPooling', status)
  },

  async sendMessage(
    context: ActionContext<State, State>,
    request: SendMessageRequest
  ) {
    try {
      const response = await axios.post('/v1/messages/send', request)
      await context.dispatch('addNotification', {
        message: response.data.message,
        type: 'success',
      })
    } catch (e) {
      await context.dispatch('addNotification', {
        message:
          (e as AxiosError).response?.data?.message ??
          'Error while sending message',
        type: 'error',
      })
    }
    await Promise.all([context.dispatch('loadThreads')])
  },

  setThreadId(context: ActionContext<State, State>, threadId: string | null) {
    context.commit('setThreadId', threadId)
  },

  addNotification(
    context: ActionContext<State, State>,
    request: NotificationRequest
  ) {
    context.commit('setNotification', request)
  },

  disableNotification(context: ActionContext<State, State>) {
    context.commit('disableNotification')
  },

  loadThreadMessages(
    context: ActionContext<State, State>,
    threadId: string | null
  ): Promise<Array<Message>> {
    context.commit('setThreadId', threadId)
    return new Promise<Array<Message>>((resolve, reject) => {
      axios
        .get('/v1/messages', {
          params: {
            contact: context.getters.getThread.contact,
            owner: context.getters.getThread.owner,
            limit: 100,
          },
        })
        .then((response: AxiosResponse) => {
          resolve(response.data.data)
        })
        .catch(async (error: AxiosError) => {
          await context.dispatch('addNotification', {
            message:
              error.response?.data?.message ?? 'Errors while fetching messages',
            type: 'error',
          })
          reject(error)
        })
    })
  },

  async setAuthUser(
    context: ActionContext<State, State>,
    user: AuthUser | null | undefined
  ) {
    const userChanged = user?.id !== context.getters.getAuthUser?.id

    if (user === undefined) {
      user = null
    }

    await context.commit('setAuthUser', user)

    if (userChanged && user !== null) {
      await Promise.all([
        context.dispatch('loadUser'),
        context.dispatch('loadPhones'),
      ])

      const phone = context.getters.getPhones.find(
        (x: Phone) => x.id === context.getters.getUser.active_phone_id
      )
      if (phone) {
        await context.dispatch('updateUser', {
          owner: phone.phone_number,
          timezone: context.getters.getUser.timezone,
        })
      }
    }
  },
  async onAuthStateChanged(
    context: ActionContext<State, State>,
    // @ts-ignore
    { authUser }
  ) {
    if (authUser == null) {
      await Promise.all([
        context.commit('setAuthUser', null),
        context.commit('setUser', null),
      ])
      setApiKey('')
      return
    }
    setAuthHeader(await authUser.getIdToken())
    const { uid, email, displayName } = authUser
    await Promise.all([
      context.commit('setAuthUser', { id: uid, email, displayName }),
    ])
  },

  async onIdTokenChanged(
    _: ActionContext<State, State>,
    // @ts-ignore
    { authUser }
  ) {
    if (authUser == null) {
      setApiKey('')
      return
    }
    setAuthHeader(await authUser.getIdToken())
  },

  async clearAxiosError(context: ActionContext<State, State>) {
    await context.commit('setAxiosError', null)
  },

  async updateUser(
    context: ActionContext<State, State>,
    payload: { owner: string; timezone: string }
  ) {
    await context.commit('setOwner', payload.owner)

    const phone = context.getters.getActivePhone as Phone | null
    if (!phone) {
      return
    }

    const response = await axios.put('/v1/users/me', {
      active_phone_id: phone.id,
      timezone: payload.timezone ?? context.getters.getUser.timezone,
    })

    setApiKey(response.data.data.api_key)
    context.commit('setUser', response.data.data)
  },

  async updateThread(
    context: ActionContext<State, State>,
    payload: { threadId: string; isArchived: boolean }
  ) {
    await axios.put(`/v1/message-threads/${payload.threadId}`, {
      is_archived: payload.isArchived,
    })
    await context.commit('setArchivedThreads', payload.isArchived)
    await context.dispatch('loadThreads')
  },

  getSubscriptionUpdateLink(context: ActionContext<State, State>) {
    return new Promise<string>((resolve, reject) => {
      axios
        .get<ResponsesOkString>(`/v1/users/subscription-update-url`)
        .then((response: AxiosResponse<ResponsesOkString>) => {
          resolve(response.data.data)
        })
        .catch(async (error: AxiosError) => {
          await Promise.all([
            context.dispatch('addNotification', {
              message:
                error.response?.data?.message ??
                'Error while fetching the update URL',
              type: 'error',
            }),
          ])
          reject(error)
        })
    })
  },

  cancelSubscription(context: ActionContext<State, State>) {
    return new Promise<string>((resolve, reject) => {
      axios
        .delete<ResponsesNoContent>(`/v1/users/subscription`)
        .then((response: AxiosResponse<ResponsesNoContent>) => {
          resolve(response.data.message)
        })
        .catch(async (error: AxiosError) => {
          await Promise.all([
            context.dispatch('addNotification', {
              message:
                error.response?.data?.message ??
                'Error while cancelling your subscription',
              type: 'error',
            }),
          ])
          reject(error)
        })
    })
  },

  createDiscord(
    context: ActionContext<State, State>,
    payload: RequestsDiscordStore
  ): Promise<EntitiesDiscord> {
    return new Promise<EntitiesDiscord>((resolve, reject) => {
      axios
        .post<ResponsesDiscordResponse>(`/v1/discord-integrations`, payload)
        .then((response: AxiosResponse<ResponsesDiscordResponse>) => {
          resolve(response.data.data)
        })
        .catch(async (error: AxiosError) => {
          await Promise.all([
            context.dispatch('addNotification', {
              message:
                error.response?.data?.message ??
                'Error while adding discord integration',
              type: 'error',
            }),
          ])
          reject(getErrorMessages(error))
        })
    })
  },

  getDiscordIntegrations(context: ActionContext<State, State>) {
    return new Promise<Array<EntitiesDiscord>>((resolve, reject) => {
      axios
        .get<ResponsesDiscordsResponse>(`/v1/discord-integrations`, {
          params: {
            limit: 100,
          },
        })
        .then((response: AxiosResponse<ResponsesDiscordsResponse>) => {
          resolve(response.data.data)
        })
        .catch(async (error: AxiosError) => {
          await Promise.all([
            context.dispatch('addNotification', {
              message:
                error.response?.data?.message ??
                'Error while fetching discord integrations',
              type: 'error',
            }),
          ])
          reject(getErrorMessages(error))
        })
    })
  },

  updateDiscordIntegration(
    context: ActionContext<State, State>,
    payload: RequestsDiscordUpdate & { id: string }
  ) {
    return new Promise<EntitiesDiscord>((resolve, reject) => {
      axios
        .put<ResponsesDiscordResponse>(
          `/v1/discord-integrations/${payload.id}`,
          payload
        )
        .then((response: AxiosResponse<ResponsesDiscordResponse>) => {
          resolve(response.data.data)
        })
        .catch(async (error: AxiosError) => {
          await Promise.all([
            context.dispatch('addNotification', {
              message:
                error.response?.data?.message ??
                'Error while updating discord integration',
              type: 'error',
            }),
          ])
          reject(getErrorMessages(error))
        })
    })
  },

  deleteDiscordIntegration(
    context: ActionContext<State, State>,
    payload: string
  ) {
    return new Promise<void>((resolve, reject) => {
      axios
        .delete<ResponsesNoContent>(`/v1/discord-integrations/${payload}`)
        .then(() => {
          resolve()
        })
        .catch(async (error: AxiosError) => {
          await Promise.all([
            context.dispatch('addNotification', {
              message:
                error.response?.data?.message ??
                'Error while deleting discord integration',
              type: 'error',
            }),
          ])
          reject(getErrorMessages(error))
        })
    })
  },

  createWebhook(
    context: ActionContext<State, State>,
    payload: RequestsWebhookStore
  ) {
    return new Promise<EntitiesWebhook>((resolve, reject) => {
      axios
        .post<ResponsesWebhookResponse>(`/v1/webhooks`, payload)
        .then((response: AxiosResponse<ResponsesWebhookResponse>) => {
          resolve(response.data.data)
        })
        .catch(async (error: AxiosError) => {
          await Promise.all([
            context.dispatch('addNotification', {
              message:
                error.response?.data?.message ?? 'Error while adding webhook',
              type: 'error',
            }),
          ])
          reject(getErrorMessages(error))
        })
    })
  },

  getWebhooks(context: ActionContext<State, State>) {
    return new Promise<Array<EntitiesWebhook>>((resolve, reject) => {
      axios
        .get<ResponsesWebhooksResponse>(`/v1/webhooks`, {
          params: {
            limit: 100,
          },
        })
        .then((response: AxiosResponse<ResponsesWebhooksResponse>) => {
          resolve(response.data.data)
        })
        .catch(async (error: AxiosError) => {
          await Promise.all([
            context.dispatch('addNotification', {
              message:
                error.response?.data?.message ??
                'Error while fetching webhooks',
              type: 'error',
            }),
          ])
          reject(getErrorMessages(error))
        })
    })
  },

  updateWebhook(
    context: ActionContext<State, State>,
    payload: RequestsWebhookUpdate & { id: string }
  ) {
    return new Promise<EntitiesWebhook>((resolve, reject) => {
      axios
        .put<ResponsesWebhookResponse>(`/v1/webhooks/${payload.id}`, payload)
        .then((response: AxiosResponse<ResponsesWebhookResponse>) => {
          resolve(response.data.data)
        })
        .catch(async (error: AxiosError) => {
          await Promise.all([
            context.dispatch('addNotification', {
              message:
                error.response?.data?.message ?? 'Error while updating webhook',
              type: 'error',
            }),
          ])
          reject(getErrorMessages(error))
        })
    })
  },

  deleteWebhook(context: ActionContext<State, State>, payload: string) {
    return new Promise<void>((resolve, reject) => {
      axios
        .delete<ResponsesNoContent>(`/v1/webhooks/${payload}`)
        .then(() => {
          resolve()
        })
        .catch(async (error: AxiosError) => {
          await Promise.all([
            context.dispatch('addNotification', {
              message:
                error.response?.data?.message ?? 'Error while deleting webhook',
              type: 'error',
            }),
          ])
          reject(getErrorMessages(error))
        })
    })
  },
}
