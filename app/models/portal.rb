# == Schema Information
#
# Table name: portals
#
#  id                    :bigint           not null, primary key
#  archived              :boolean          default(FALSE)
#  color                 :string
#  config                :jsonb
#  custom_domain         :string
#  header_text           :text
#  homepage_link         :string
#  name                  :string           not null
#  page_title            :string
#  slug                  :string           not null
#  ssl_settings          :jsonb            not null
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  account_id            :integer          not null
#  channel_web_widget_id :bigint
#
# Indexes
#
#  index_portals_on_channel_web_widget_id  (channel_web_widget_id)
#  index_portals_on_custom_domain          (custom_domain) UNIQUE
#  index_portals_on_slug                   (slug) UNIQUE
#
class Portal < ApplicationRecord
  include Rails.application.routes.url_helpers

  belongs_to :account
  has_many :categories, dependent: :destroy_async
  has_many :folders,  through: :categories
  has_many :articles, dependent: :destroy_async
  has_one_attached :logo
  has_many :inboxes, dependent: :nullify
  belongs_to :channel_web_widget, class_name: 'Channel::WebWidget', optional: true

  before_validation -> { normalize_empty_string_to_nil(%i[custom_domain homepage_link]) }
  validates :account_id, presence: true
  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true
  validates :custom_domain, uniqueness: true, allow_nil: true
  validate :config_json_format

  scope :active, -> { where(archived: false) }

  CONFIG_JSON_KEYS = %w[allowed_locales default_locale website_token].freeze

  def file_base_data
    {
      id: logo.id,
      portal_id: id,
      file_type: logo.content_type,
      account_id: account_id,
      file_url: url_for(logo),
      blob_id: logo.blob_id,
      filename: logo.filename.to_s
    }
  end

  def default_locale
    config['default_locale'] || 'en'
  end

  private

  def config_json_format
    config['default_locale'] = default_locale
    denied_keys = config.keys - CONFIG_JSON_KEYS
    errors.add(:cofig, "in portal on #{denied_keys.join(',')} is not supported.") if denied_keys.any?
  end
end

Portal.include_mod_with('Concerns::Portal')
