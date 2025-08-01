class MicrosoftController < ApplicationController
  after_action :set_version_header

  def identity_association
    microsoft_identity
  end

  private

  def set_version_header
    response.headers['Content-Length'] = { associatedApplications: [{ applicationId: @identity_json }] }.to_json.length
  end

  def microsoft_identity
    @identity_json = GlobalConfigService.load('AZURE_APP_ID', nil)
  end
end
