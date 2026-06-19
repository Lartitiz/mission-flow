/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface QA {
  theme?: string
  question: string
  answer: string
}

interface Props {
  clientName?: string
  missionType?: string
  submittedAt?: string
  missionUrl?: string
  responses?: QA[]
}

const Email = ({
  clientName = 'Une cliente',
  missionType = '',
  submittedAt = '',
  missionUrl = '#',
  responses = [],
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{clientName} a complété son questionnaire de kick-off</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>📝 Questionnaire complété</Heading>
        <Text style={text}>
          <strong style={{ color: '#91014b' }}>{clientName}</strong> vient de soumettre ses réponses au questionnaire de kick-off.
          {missionType ? ` (${missionType})` : ''}
        </Text>
        {submittedAt && <Text style={meta}>Soumis le {submittedAt}</Text>}

        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button href={missionUrl} style={button}>
            Voir dans la mission
          </Button>
        </Section>

        <Hr style={hr} />
        <Heading as="h2" style={h2}>Réponses</Heading>

        {responses.length === 0 && (
          <Text style={text}>Aucune réponse fournie.</Text>
        )}

        {responses.map((qa, i) => (
          <Section key={i} style={card}>
            {qa.theme && <Text style={themeStyle}>{qa.theme}</Text>}
            <Text style={questionStyle}>{qa.question}</Text>
            <Text style={answerStyle}>{qa.answer || '—'}</Text>
          </Section>
        ))}

        <Text style={footer}>
          Tu reçois cet email parce qu'une cliente a complété son questionnaire.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Props) =>
    `📝 ${data?.clientName ?? 'Une cliente'} a complété son questionnaire`,
  displayName: 'Questionnaire complété',
  previewData: {
    clientName: 'Marie Dupont',
    missionType: 'Identité de marque',
    submittedAt: '19 juin 2026',
    missionUrl: 'https://nowadays-mission-flow.lovable.app/missions/123',
    responses: [
      { theme: 'Ton histoire', question: 'Quelle est ton histoire ?', answer: 'Tout a commencé en 2020...' },
      { theme: 'Ton identité', question: 'Ta mission ?', answer: 'Rendre la communication accessible.' },
    ],
  },
} satisfies TemplateEntry<Props>

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif',
}
const container = { maxWidth: '640px', margin: '0 auto', padding: '40px 24px' }
const h1 = {
  fontFamily: '"Libre Baskerville", Georgia, serif',
  color: '#91014b',
  fontSize: '24px',
  marginBottom: '16px',
}
const h2 = {
  fontFamily: '"Libre Baskerville", Georgia, serif',
  color: '#91014b',
  fontSize: '18px',
  margin: '24px 0 16px',
}
const text = { color: '#1A1A2E', fontSize: '15px', lineHeight: '1.6' }
const meta = { color: '#666', fontSize: '13px', margin: '0 0 8px 0' }
const card = {
  background: '#FFF7FA',
  border: '1px solid #F5C2D6',
  borderRadius: '10px',
  padding: '16px 18px',
  margin: '12px 0',
}
const themeStyle = {
  color: '#FB3D80',
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  margin: '0 0 4px 0',
  fontWeight: '600',
}
const questionStyle = {
  color: '#91014b',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0 0 6px 0',
}
const answerStyle = {
  color: '#1A1A2E',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: 0,
  whiteSpace: 'pre-wrap' as const,
}
const button = {
  background: '#FB3D80',
  color: '#ffffff',
  padding: '12px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontSize: '15px',
  fontWeight: '600',
  display: 'inline-block',
}
const hr = { borderColor: '#F5C2D6', margin: '24px 0' }
const footer = {
  color: '#999',
  fontSize: '12px',
  textAlign: 'center' as const,
  marginTop: '32px',
}
