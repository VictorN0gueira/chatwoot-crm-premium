class RemoveNotNullFromCaptainDocuments < ActiveRecord::Migration[7.0]
  def change
    # A saltar esta migração porque a tabela 'captain_documents' não foi criada.
    # change_column_null :captain_documents, :name, true
  end
end
