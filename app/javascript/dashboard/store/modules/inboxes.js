import * as MutationHelpers from 'shared/helpers/vuex/mutationHelpers';
import * as types from '../mutation-types';
import { INBOX_TYPES } from 'dashboard/helper/inbox';
import InboxesAPI from '../../api/inboxes';
import WebChannel from '../../api/channel/webChannel';
import FBChannel from '../../api/channel/fbChannel';
import TwilioChannel from '../../api/channel/twilioChannel';
import WhatsappChannel from '../../api/channel/whatsappChannel';
import { throwErrorMessage } from '../utils/api';
import AnalyticsHelper from '../../helper/AnalyticsHelper';
import camelcaseKeys from 'camelcase-keys';
import { ACCOUNT_EVENTS } from '../../helper/AnalyticsHelper/events';
import { channelActions, buildInboxData } from './inboxes/channelActions';

export const state = {
  records: [],
  uiFlags: {
    isFetching: false,
    isFetchingItem: false,
    isCreating: false,
    isUpdating: false,
    isDeleting: false,
    isUpdatingIMAP: false,
    isUpdatingSMTP: false,
  },
};

export const getters = {
  getInboxes($state) {
    return $state.records;
  },
  getWhatsAppTemplates: $state => inboxId => {
    const [inbox] = $state.records.filter(
      record => record.id === Number(inboxId)
    );

    const {
      message_templates: whatsAppMessageTemplates,
      additional_attributes: additionalAttributes,
    } = inbox || {};

    const { message_templates: apiInboxMessageTemplates } =
      additionalAttributes || {};
    const messagesTemplates =
      whatsAppMessageTemplates || apiInboxMessageTemplates;

    // filtering out the whatsapp templates with media
    if (messagesTemplates instanceof Array) {
      return messagesTemplates.filter(template => {
        return !template.components.some(
          i => i.format === 'IMAGE' || i.format === 'VIDEO'
        );
      });
    }
    return [];
  },
  getNewConversationInboxes($state) {
    return $state.records.filter(inbox => {
      const { channel_type: channelType, phone_number: phoneNumber = '' } =
        inbox;

      const isEmailChannel = channelType === INBOX_TYPES.EMAIL;
      const isSmsChannel =
        channelType === INBOX_TYPES.TWILIO &&
        phoneNumber.startsWith('whatsapp');
      return isEmailChannel || isSmsChannel;
    });
  },
  getInbox: $state => inboxId => {
    const [inbox] = $state.records.filter(
      record => record.id === Number(inboxId)
    );
    return inbox || {};
  },
  getInboxById: $state => inboxId => {
    const [inbox] = $state.records.filter(
      record => record.id === Number(inboxId)
    );
    return camelcaseKeys(inbox || {}, { deep: true });
  },
  getUIFlags($state) {
    return $state.uiFlags;
  },
  getWebsiteInboxes($state) {
    return $state.records.filter(item => item.channel_type === INBOX_TYPES.WEB);
  },
  getTwilioInboxes($state) {
    return $state.records.filter(
      item => item.channel_type === INBOX_TYPES.TWILIO
    );
  },
  getSMSInboxes($state) {
    return $state.records.filter(
      item =>
        item.channel_type === INBOX_TYPES.SMS ||
        (item.channel_type === INBOX_TYPES.TWILIO && item.medium === 'sms')
    );
  },
  getWhatsAppInboxes($state) {
    return $state.records.filter(
      item => item.channel_type === INBOX_TYPES.WHATSAPP
    );
  },
  dialogFlowEnabledInboxes($state) {
    return $state.records.filter(
      item => item.channel_type !== INBOX_TYPES.EMAIL
    );
  },
  getFacebookInboxByInstagramId: $state => instagramId => {
    return $state.records.find(
      item =>
        item.instagram_id === instagramId &&
        item.channel_type === INBOX_TYPES.FB
    );
  },
  getInstagramInboxByInstagramId: $state => instagramId => {
    return $state.records.find(
      item =>
        item.instagram_id === instagramId &&
        item.channel_type === INBOX_TYPES.INSTAGRAM
    );
  },
};

const sendAnalyticsEvent = channelType => {
  AnalyticsHelper.track(ACCOUNT_EVENTS.ADDED_AN_INBOX, {
    channelType,
  });
};

export const actions = {
  revalidate: async ({ commit }, { newKey }) => {
    try {
      const isExistingKeyValid = await InboxesAPI.validateCacheKey(newKey);
      if (!isExistingKeyValid) {
        const response = await InboxesAPI.refetchAndCommit(newKey);
        commit(types.default.SET_INBOXES, response.data.payload);
      }
    } catch (error) {
      // Ignore error
    }
  },
  get: async ({ commit }) => {
    commit(types.default.SET_INBOXES_UI_FLAG, { isFetching: true });
    try {
      const response = await InboxesAPI.get(true);
      commit(types.default.SET_INBOXES_UI_FLAG, { isFetching: false });
      commit(types.default.SET_INBOXES, response.data.payload);
    } catch (error) {
      commit(types.default.SET_INBOXES_UI_FLAG, { isFetching: false });
    }
  },
  createChannel: async ({ commit }, params) => {
    try {
      commit(types.default.SET_INBOXES_UI_FLAG, { isCreating: true });
      const response = await WebChannel.create(params);
      commit(types.default.ADD_INBOXES, response.data);
      commit(types.default.SET_INBOXES_UI_FLAG, { isCreating: false });
      const { channel = {} } = params;
      sendAnalyticsEvent(channel.type);
      return response.data;
    } catch (error) {
      const errorMessage = error?.response?.data?.message;
      commit(types.default.SET_INBOXES_UI_FLAG, { isCreating: false });
      throw new Error(errorMessage);
    }
  },
  createWebsiteChannel: async ({ commit }, params) => {
    try {
      commit(types.default.SET_INBOXES_UI_FLAG, { isCreating: true });
      const response = await WebChannel.create(buildInboxData(params));
      commit(types.default.ADD_INBOXES, response.data);
      commit(types.default.SET_INBOXES_UI_FLAG, { isCreating: false });
      sendAnalyticsEvent('website');
      return response.data;
    } catch (error) {
      commit(types.default.SET_INBOXES_UI_FLAG, { isCreating: false });
      return throwErrorMessage(error);
    }
  },
  createTwilioChannel: async ({ commit }, params) => {
    try {
      commit(types.default.SET_INBOXES_UI_FLAG, { isCreating: true });
      const response = await TwilioChannel.create(params);
      commit(types.default.ADD_INBOXES, response.data);
      commit(types.default.SET_INBOXES_UI_FLAG, { isCreating: false });
      sendAnalyticsEvent('twilio');
      return response.data;
    } catch (error) {
      commit(types.default.SET_INBOXES_UI_FLAG, { isCreating: false });
      throw error;
    }
  },
  createFBChannel: async ({ commit }, params) => {
    try {
      commit(types.default.SET_INBOXES_UI_FLAG, { isCreating: true });
      const response = await FBChannel.create(params);
      commit(types.default.ADD_INBOXES, response.data);
      commit(types.default.SET_INBOXES_UI_FLAG, { isCreating: false });
      sendAnalyticsEvent('facebook');
      return response.data;
    } catch (error) {
      commit(types.default.SET_INBOXES_UI_FLAG, { isCreating: false });
      throw new Error(error);
    }
  },
  createWhatsAppEmbeddedSignup: async ({ commit }, params) => {
    try {
      commit(types.default.SET_INBOXES_UI_FLAG, { isCreating: true });
      const response = await WhatsappChannel.createEmbeddedSignup(params);
      commit(types.default.ADD_INBOXES, response.data);
      commit(types.default.SET_INBOXES_UI_FLAG, { isCreating: false });
      sendAnalyticsEvent('whatsapp');
      return response.data;
    } catch (error) {
      commit(types.default.SET_INBOXES_UI_FLAG, { isCreating: false });
      throw error;
    }
  },
  ...channelActions,
  // TODO: Extract other create channel methods to separate files to reduce file size
  // - createChannel
  // - createWebsiteChannel
  // - createTwilioChannel
  // - createFBChannel
  updateInbox: async ({ commit }, { id, formData = true, ...inboxParams }) => {
    commit(types.default.SET_INBOXES_UI_FLAG, { isUpdating: true });
    try {
      const response = await InboxesAPI.update(
        id,
        formData ? buildInboxData(inboxParams) : inboxParams
      );
      commit(types.default.EDIT_INBOXES, response.data);
      commit(types.default.SET_INBOXES_UI_FLAG, { isUpdating: false });
    } catch (error) {
      commit(types.default.SET_INBOXES_UI_FLAG, { isUpdating: false });
      throwErrorMessage(error);
    }
  },
  updateInboxIMAP: async ({ commit }, { id, ...inboxParams }) => {
    commit(types.default.SET_INBOXES_UI_FLAG, { isUpdatingIMAP: true });
    try {
      const response = await InboxesAPI.update(id, inboxParams);
      commit(types.default.EDIT_INBOXES, response.data);
      commit(types.default.SET_INBOXES_UI_FLAG, { isUpdatingIMAP: false });
    } catch (error) {
      commit(types.default.SET_INBOXES_UI_FLAG, { isUpdatingIMAP: false });
      throwErrorMessage(error);
    }
  },
  updateInboxSMTP: async ({ commit }, { id, ...inboxParams }) => {
    commit(types.default.SET_INBOXES_UI_FLAG, { isUpdatingSMTP: true });
    try {
      const response = await InboxesAPI.update(id, inboxParams);
      commit(types.default.EDIT_INBOXES, response.data);
      commit(types.default.SET_INBOXES_UI_FLAG, { isUpdatingSMTP: false });
    } catch (error) {
      commit(types.default.SET_INBOXES_UI_FLAG, { isUpdatingSMTP: false });
      throwErrorMessage(error);
    }
  },
  delete: async ({ commit }, inboxId) => {
    commit(types.default.SET_INBOXES_UI_FLAG, { isDeleting: true });
    try {
      await InboxesAPI.delete(inboxId);
      commit(types.default.DELETE_INBOXES, inboxId);
      commit(types.default.SET_INBOXES_UI_FLAG, { isDeleting: false });
    } catch (error) {
      commit(types.default.SET_INBOXES_UI_FLAG, { isDeleting: false });
      throw new Error(error);
    }
  },
  reauthorizeFacebookPage: async ({ commit }, params) => {
    try {
      const response = await FBChannel.reauthorizeFacebookPage(params);
      commit(types.default.EDIT_INBOXES, response.data);
    } catch (error) {
      throw new Error(error.message);
    }
  },
  deleteInboxAvatar: async (_, inboxId) => {
    try {
      await InboxesAPI.deleteInboxAvatar(inboxId);
    } catch (error) {
      throw new Error(error);
    }
  },
  syncTemplates: async (_, inboxId) => {
    try {
      await InboxesAPI.syncTemplates(inboxId);
    } catch (error) {
      throw new Error(error);
    }
  },
};

export const mutations = {
  [types.default.SET_INBOXES_UI_FLAG]($state, uiFlag) {
    $state.uiFlags = { ...$state.uiFlags, ...uiFlag };
  },
  [types.default.SET_INBOXES]: MutationHelpers.set,
  [types.default.SET_INBOXES_ITEM]: MutationHelpers.setSingleRecord,
  [types.default.ADD_INBOXES]: MutationHelpers.create,
  [types.default.EDIT_INBOXES]: MutationHelpers.update,
  [types.default.DELETE_INBOXES]: MutationHelpers.destroy,
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
