/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry<P = any> {
  component: (props: P) => React.ReactElement
  subject: string | ((data: P) => string)
  displayName?: string
  previewData?: P
  to?: string
}

import { template as clientFileUploaded } from './client-file-uploaded.tsx'
import { template as questionnaireSubmitted } from './questionnaire-submitted.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'client-file-uploaded': clientFileUploaded,
  'questionnaire-submitted': questionnaireSubmitted,
}
