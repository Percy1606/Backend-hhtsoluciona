ALTER TABLE documento ADD COLUMN area ENUM('LogisticaYRecursos', 'IngenieriaYSupervision', 'GestionDocumentaria', 'OperacionesDeCampo') NULL;
CREATE INDEX documento_area_idx ON documento(area);