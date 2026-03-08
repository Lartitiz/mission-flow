export interface StructuredSection {
  title: string;
  content: string;
}

export interface StructuredNotes {
  sections: StructuredSection[];
  suggested_type: 'binome' | 'agency' | 'non_determine';
  type_justification: string;
}
