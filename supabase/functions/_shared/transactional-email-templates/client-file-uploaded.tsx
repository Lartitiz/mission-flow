/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  clientName?: string
  fileName?: string
  fileSize?: string
  uploadedAt?: string
  missionUrl?: string
}

const Email = ({
  clientName = 'Une cliente',
  fileName = 'document.pdf',
  fileSize = '',
  uploadedAt = '',
  missionUrl = '#',
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{clientName} a déposé un nouveau document : {fileName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>📎 Nouveau document déposé</Heading>
        <Text style={text}>
          <strong style={{ color: '#91014b' }}>{clientName}</strong> vient de déposer un document dans son espace client.
        </Text>
        <Section style={card}>
          <Text style={fileNameStyle}>{fileName}</Text>
          {(fileSize || uploadedAt) && (
            <Text style={meta}>
              {fileSize}
              {fileSize && uploadedAt ? ' · ' : ''}
              {uploadedAt}
            </Text>
          )}
        </Section>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={missionUrl} style={button}>
            Voir dans la mission
          </Button>
        </Section>
        <Text style={footer}>
          Tu reçois cet email parce qu'une cliente a déposé un document dans son espace.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Props) =>
    `📎 ${data?.clientName ?? 'Une cliente'} a déposé un nouveau document`,
  displayName: 'Dépôt de document client',
  previewData: {
    clientName: 'Marie Dupont',
    fileName: 'brief-projet-v2.pdf',
    fileSize: '1.2 Mo',
    uploadedAt: '19 juin 2026',
    missionUrl: 'https://nowadays-mission-flow.lovable.app/missions/123',
  },
} satisfies TemplateEntry<Props>

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, sans-serif',
}
const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '40px 24px',
}
const h1 = {
  fontFamily: '"Libre Baskerville", Georgia, serif',
  color: '#91014b',
  fontSize: '24px',
  marginBottom: '24px',
}
const text = {
  color: '#1A1A2E',
  fontSize: '15px',
  lineHeight: '1.6',
}
const card = {
  background: '#FFF0F5',
  border: '1px solid #FB3D80',
  borderRadius: '12px',
  padding: '20px',
  margin: '24px 0',
}
const fileNameStyle = {
  color: '#91014b',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 6px 0',
}
const meta = {
  color: '#666',
  fontSize: '13px',
  margin: 0,
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
const footer = {
  color: '#999',
  fontSize: '12px',
  textAlign: 'center' as const,
  marginTop: '32px',
}
