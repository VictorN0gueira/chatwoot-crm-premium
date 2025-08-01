<script>
import { mapGetters } from 'vuex';
import { convertSecondsToTimeUnit } from '@chatwoot/utils';
import validations from './validations';
import SlaTimeInput from './SlaTimeInput.vue';
import NextButton from 'dashboard/components-next/button/Button.vue';
import { useVuelidate } from '@vuelidate/core';
import ToggleSwitch from 'dashboard/components-next/switch/Switch.vue';

export default {
  components: {
    SlaTimeInput,
    NextButton,
    ToggleSwitch,
  },
  props: {
    selectedResponse: {
      type: Object,
      default: () => {},
    },
    submitLabel: {
      type: String,
      required: true,
    },
  },
  emits: ['close', 'submitSla'],
  setup() {
    return { v$: useVuelidate() };
  },
  data() {
    return {
      name: '',
      description: '',
      isSlaTimeInputsInvalid: false,
      slaTimeInputsValidation: {},
      slaTimeInputs: [
        {
          threshold: null,
          unit: 'Minutes',
          label: 'SLA.FORM.FIRST_RESPONSE_TIME.LABEL',
          placeholder: 'SLA.FORM.FIRST_RESPONSE_TIME.PLACEHOLDER',
        },
        {
          threshold: null,
          unit: 'Minutes',
          label: 'SLA.FORM.NEXT_RESPONSE_TIME.LABEL',
          placeholder: 'SLA.FORM.NEXT_RESPONSE_TIME.PLACEHOLDER',
        },
        {
          threshold: null,
          unit: 'Minutes',
          label: 'SLA.FORM.RESOLUTION_TIME.LABEL',
          placeholder: 'SLA.FORM.RESOLUTION_TIME.PLACEHOLDER',
        },
      ],
      onlyDuringBusinessHours: false,
    };
  },
  validations,
  computed: {
    ...mapGetters({
      uiFlags: 'sla/getUIFlags',
    }),
    isSubmitDisabled() {
      return (
        this.v$.name.$invalid ||
        this.isSlaTimeInputsInvalid ||
        this.uiFlags.isUpdating
      );
    },
    slaNameErrorMessage() {
      let errorMessage = '';
      if (this.v$.name.$error) {
        if (!this.v$.name.required) {
          errorMessage = this.$t('SLA.FORM.NAME.REQUIRED_ERROR');
        } else if (!this.v$.name.minLength) {
          errorMessage = this.$t('SLA.FORM.NAME.MINIMUM_LENGTH_ERROR');
        }
      }
      return errorMessage;
    },
  },
  mounted() {
    if (this.selectedResponse) this.setFormValues();
  },
  methods: {
    onClose() {
      this.$emit('close');
    },
    setFormValues() {
      const {
        name,
        description,
        first_response_time_threshold: firstResponseTimeThreshold,
        next_response_time_threshold: nextResponseTimeThreshold,
        resolution_time_threshold: resolutionTimeThreshold,
        only_during_business_hours: onlyDuringBusinessHours,
      } = this.selectedResponse;

      this.name = name;
      this.description = description;
      this.onlyDuringBusinessHours = onlyDuringBusinessHours;

      const thresholds = [
        firstResponseTimeThreshold,
        nextResponseTimeThreshold,
        resolutionTimeThreshold,
      ];
      this.slaTimeInputs.forEach((input, index) => {
        const converted = convertSecondsToTimeUnit(thresholds[index], {
          minute: 'Minutes',
          hour: 'Hours',
          day: 'Days',
        });
        input.threshold = converted.time;
        input.unit = converted.unit;
      });
    },
    updateThreshold(index, value) {
      this.slaTimeInputs[index].threshold = value;
    },
    updateUnit(index, unit) {
      this.slaTimeInputs[index].unit = unit;
    },
    onSubmit() {
      const payload = {
        name: this.name,
        description: this.description,
        first_response_time_threshold: this.convertToSeconds(0),
        next_response_time_threshold: this.convertToSeconds(1),
        resolution_time_threshold: this.convertToSeconds(2),
        only_during_business_hours: this.onlyDuringBusinessHours,
      };
      this.$emit('submitSla', payload);
    },
    convertToSeconds(index) {
      const { threshold, unit } = this.slaTimeInputs[index];
      if (threshold === null || threshold === 0) return null;
      const unitsToSeconds = { Minutes: 60, Hours: 3600, Days: 86400 };
      return Number(threshold * (unitsToSeconds[unit] || 1));
    },
    handleIsInvalid(index, isInvalid) {
      this.slaTimeInputsValidation = {
        ...this.slaTimeInputsValidation,
        [index]: isInvalid,
      };

      this.checkValidationState();
    },
    checkValidationState() {
      const isAnyInvalid = Object.values(this.slaTimeInputsValidation).some(
        isInvalid => isInvalid
      );
      this.isSlaTimeInputsInvalid = isAnyInvalid;
    },
  },
};
</script>

<template>
  <div class="flex flex-col h-auto overflow-auto">
    <form class="flex flex-wrap mx-0" @submit.prevent="onSubmit">
      <woot-input
        v-model="name"
        :class="{ error: v$.name.$error }"
        class="w-full"
        :styles="{
          borderRadius: '0.75rem',
          padding: '0.375rem 0.75rem',
          fontSize: '0.875rem',
        }"
        :label="$t('SLA.FORM.NAME.LABEL')"
        :placeholder="$t('SLA.FORM.NAME.PLACEHOLDER')"
        :error="slaNameErrorMessage"
        @input="v$.name.$touch"
        @blur="v$.name.$touch"
      />
      <woot-input
        v-model="description"
        class="w-full"
        :styles="{
          borderRadius: '0.75rem',
          padding: '0.375rem 0.75rem',
          fontSize: '0.875rem',
        }"
        :label="$t('SLA.FORM.DESCRIPTION.LABEL')"
        :placeholder="$t('SLA.FORM.DESCRIPTION.PLACEHOLDER')"
      />

      <SlaTimeInput
        v-for="(input, index) in slaTimeInputs"
        :key="index"
        :threshold="input.threshold"
        :threshold-unit="input.unit"
        :label="$t(input.label)"
        :placeholder="$t(input.placeholder)"
        @update-threshold="updateThreshold(index, $event)"
        @unit="updateUnit(index, $event)"
        @is-in-valid="handleIsInvalid(index, $event)"
      />

      <div
        class="mt-3 flex h-10 items-center text-sm w-full gap-2 border border-solid border-n-strong px-3 py-1.5 rounded-xl justify-between"
      >
        <span for="sla_bh" class="text-n-slate-11">
          {{ $t('SLA.FORM.BUSINESS_HOURS.PLACEHOLDER') }}
        </span>
        <ToggleSwitch id="sla_bh" v-model="onlyDuringBusinessHours" />
      </div>

      <div class="flex items-center justify-end w-full gap-2 mt-8">
        <NextButton
          faded
          slate
          type="reset"
          :label="$t('SLA.FORM.CANCEL')"
          @click.prevent="onClose"
        />
        <NextButton
          type="submit"
          :label="submitLabel"
          :disabled="isSubmitDisabled"
          :is-loading="uiFlags.isUpdating"
        />
      </div>
    </form>
  </div>
</template>
