<script>
import { mapGetters } from 'vuex';
import { useAlert } from 'dashboard/composables';
import TableHeaderCell from 'dashboard/components/widgets/TableHeaderCell.vue';
import CheckBox from 'v3/components/Form/CheckBox.vue';
import {
  hasPushPermissions,
  requestPushPermissions,
  verifyServiceWorkerExistence,
} from 'dashboard/helper/pushHelper.js';
import { FEATURE_FLAGS } from 'dashboard/featureFlags';
import ToggleSwitch from 'dashboard/components-next/switch/Switch.vue';
import { NOTIFICATION_TYPES } from './constants';

export default {
  components: {
    TableHeaderCell,
    ToggleSwitch,
    CheckBox,
  },
  data() {
    return {
      selectedEmailFlags: [],
      selectedPushFlags: [],
      enableAudioAlerts: false,
      hasEnabledPushPermissions: false,
      notificationTypes: NOTIFICATION_TYPES,
    };
  },
  computed: {
    ...mapGetters({
      accountId: 'getCurrentAccountId',
      emailFlags: 'userNotificationSettings/getSelectedEmailFlags',
      pushFlags: 'userNotificationSettings/getSelectedPushFlags',
      isFeatureEnabledonAccount: 'accounts/isFeatureEnabledonAccount',
    }),
    hasPushAPISupport() {
      return !!('Notification' in window);
    },
    isSLAEnabled() {
      return this.isFeatureEnabledonAccount(this.accountId, FEATURE_FLAGS.SLA);
    },
    filteredNotificationTypes() {
      return this.notificationTypes.filter(notification =>
        this.isSLAEnabled
          ? true
          : ![
              'sla_missed_first_response',
              'sla_missed_next_response',
              'sla_missed_resolution',
            ].includes(notification.value)
      );
    },
  },
  watch: {
    emailFlags(value) {
      this.selectedEmailFlags = value;
    },
    pushFlags(value) {
      this.selectedPushFlags = value;
    },
  },
  mounted() {
    if (hasPushPermissions()) {
      this.getPushSubscription();
    }
    this.$store.dispatch('userNotificationSettings/get');
  },
  methods: {
    checkFlagStatus(type, flagType) {
      const selectedFlags =
        type === 'email' ? this.selectedEmailFlags : this.selectedPushFlags;
      return selectedFlags.includes(`${type}_${flagType}`);
    },
    onRegistrationSuccess() {
      this.hasEnabledPushPermissions = true;
    },
    onRequestPermissions(value) {
      if (value) {
        // Enable / re-enable push notifications
        requestPushPermissions({
          onSuccess: this.onRegistrationSuccess,
        });
      } else {
        // Disable push notifications
        this.disablePushPermissions();
      }
    },
    disablePushPermissions() {
      verifyServiceWorkerExistence(registration =>
        registration.pushManager
          .getSubscription()
          .then(subscription => {
            if (subscription) {
              return subscription.unsubscribe();
            }
            return null;
          })
          .finally(() => {
            this.hasEnabledPushPermissions = false;
          })
          .catch(() => {
            // error
          })
      );
    },
    getPushSubscription() {
      verifyServiceWorkerExistence(registration =>
        registration.pushManager
          .getSubscription()
          .then(subscription => {
            if (!subscription) {
              this.hasEnabledPushPermissions = false;
            } else {
              this.hasEnabledPushPermissions = true;
            }
          })
          // eslint-disable-next-line no-console
          .catch(error => console.log(error))
      );
    },
    async updateNotificationSettings() {
      try {
        this.$store.dispatch('userNotificationSettings/update', {
          selectedEmailFlags: this.selectedEmailFlags,
          selectedPushFlags: this.selectedPushFlags,
        });
        useAlert(this.$t('PROFILE_SETTINGS.FORM.API.UPDATE_SUCCESS'));
      } catch (error) {
        useAlert(this.$t('PROFILE_SETTINGS.FORM.API.UPDATE_ERROR'));
      }
    },
    handleInput(type, id) {
      if (type === 'email') {
        this.handleEmailInput(id);
      } else {
        this.handlePushInput(id);
      }
    },
    handleEmailInput(id) {
      this.selectedEmailFlags = this.toggleInput(this.selectedEmailFlags, id);
      this.updateNotificationSettings();
    },
    handlePushInput(id) {
      this.selectedPushFlags = this.toggleInput(this.selectedPushFlags, id);
      this.updateNotificationSettings();
    },
    toggleInput(selected, current) {
      if (selected.includes(current)) {
        const newSelectedFlags = selected.filter(flag => flag !== current);
        return newSelectedFlags;
      }
      return [...selected, current];
    },
  },
};
</script>

<template>
  <div id="profile-settings-notifications" class="flex flex-col gap-6">
    <!-- Layout for desktop devices -->
    <div class="hidden sm:block">
      <div
        class="grid content-center h-12 grid-cols-12 gap-4 py-0 rounded-t-xl"
      >
        <TableHeaderCell
          :span="7"
          label="`${$t('PROFILE_SETTINGS.FORM.NOTIFICATIONS.TYPE_TITLE')}`"
        >
          <span class="text-sm font-normal normal-case text-n-slate-11">
            {{ $t('PROFILE_SETTINGS.FORM.NOTIFICATIONS.TYPE_TITLE') }}
          </span>
        </TableHeaderCell>
        <TableHeaderCell
          :span="2"
          label="`${$t('PROFILE_SETTINGS.FORM.NOTIFICATIONS.EMAIL')}`"
        >
          <span class="text-sm font-medium normal-case text-n-slate-12">
            {{ $t('PROFILE_SETTINGS.FORM.NOTIFICATIONS.EMAIL') }}
          </span>
        </TableHeaderCell>
        <TableHeaderCell
          :span="3"
          label="`${$t('PROFILE_SETTINGS.FORM.NOTIFICATIONS.PUSH')}`"
        >
          <div class="flex items-center justify-between gap-1">
            <span
              class="text-sm font-medium normal-case text-n-slate-12 whitespace-nowrap"
            >
              {{ $t('PROFILE_SETTINGS.FORM.NOTIFICATIONS.PUSH') }}
            </span>
          </div>
        </TableHeaderCell>
      </div>
      <div
        v-for="(notification, index) in filteredNotificationTypes"
        :key="index"
      >
        <div
          class="grid items-center content-center h-12 grid-cols-12 gap-4 py-0 rounded-t-xl"
        >
          <div
            class="flex flex-row items-start gap-2 col-span-7 px-0 py-2 text-sm tracking-[0.5] rtl:text-right"
          >
            <span class="text-sm text-n-slate-12">
              {{ $t(notification.label) }}
            </span>
          </div>
          <div
            v-for="(type, typeIndex) in ['email', 'push']"
            :key="typeIndex"
            class="flex items-start gap-2 px-0 text-sm tracking-[0.5] text-left rtl:text-right"
            :class="`col-span-${type === 'push' ? 3 : 2}`"
          >
            <CheckBox
              :value="`${type}_${notification.value}`"
              :is-checked="
                checkFlagStatus(type, notification.value, selectedPushFlags)
              "
              @update="id => handleInput(type, id)"
            />
          </div>
        </div>
      </div>
    </div>
    <!--  Layout for mobile devices -->
    <div class="flex flex-col gap-6 sm:hidden">
      <span class="text-sm font-medium normal-case text-n-slate-12">
        {{ $t('PROFILE_SETTINGS.FORM.EMAIL_NOTIFICATIONS_SECTION.TITLE') }}
      </span>
      <div class="flex flex-col gap-4">
        <div
          v-for="(notification, index) in filteredNotificationTypes"
          :key="index"
          class="flex flex-row items-start gap-2"
        >
          <CheckBox
            :id="`email_${notification.value}`"
            :value="`email_${notification.value}`"
            :is-checked="checkFlagStatus('email', notification.value)"
            @update="handleEmailInput"
          />
          <span class="text-sm text-n-slate-12">{{
            $t(notification.label)
          }}</span>
        </div>
      </div>

      <div class="flex items-center justify-start gap-2">
        <span class="text-sm font-medium normal-case text-n-slate-12">
          {{ $t('PROFILE_SETTINGS.FORM.PUSH_NOTIFICATIONS_SECTION.TITLE') }}
        </span>
      </div>

      <div class="flex flex-col gap-4">
        <div
          v-for="(notification, index) in filteredNotificationTypes"
          :key="index"
          class="flex flex-row items-start gap-2"
        >
          <CheckBox
            :id="`push_${notification.value}`"
            :value="`push_${notification.value}`"
            :is-checked="checkFlagStatus('push', notification.value)"
            @update="handlePushInput"
          />
          <span class="text-sm text-n-slate-12">{{
            $t(notification.label)
          }}</span>
        </div>
      </div>
    </div>

    <div
      class="flex items-center justify-between w-full gap-2 p-4 border border-solid border-n-weak rounded-xl"
    >
      <div class="flex flex-row items-center gap-2">
        <fluent-icon
          icon="alert"
          class="flex-shrink-0 text-n-slate-12"
          size="18"
        />
        <span class="text-sm text-n-slate-12">
          {{ $t('PROFILE_SETTINGS.FORM.NOTIFICATIONS.BROWSER_PERMISSION') }}
        </span>
      </div>
      <ToggleSwitch
        v-model="hasEnabledPushPermissions"
        @change="onRequestPermissions"
      />
    </div>
  </div>
</template>
