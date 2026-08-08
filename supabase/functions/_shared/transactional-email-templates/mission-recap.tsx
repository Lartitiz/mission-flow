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
  missionLabel?: string
  recapDate?: string
  introText?: string
  doneItems?: string[]
  progressPercent?: number
  progressLabel?: string
  progressCount?: string
  upcomingItems?: string[]
  clientSpaceUrl?: string
}

const Email = ({
  clientName = '',
  missionLabel = '',
  recapDate = '',
  introText = '',
  doneItems = [],
  progressPercent = 0,
  progressLabel = '',
  progressCount = '',
  upcomingItems = [],
  clientSpaceUrl = '#',
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Le point sur ta mission : ce qu'on a fait, où on en est, ce qui arrive ✨</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Le point sur ta mission</Heading>
        <Text style={dateline}>
          {[missionLabel, recapDate ? `récap du ${recapDate}` : ''].filter(Boolean).join(' · ')}
        </Text>
        {clientName && <Text style={text}>Hello {clientName},</Text>}
        {introText && (
          <Section style={sticker}>
            <Text style={stickerText}>{introText}</Text>
          </Section>
        )}
        {doneItems.length > 0 && (
          <Section>
            <Heading as="h2" style={h2}>Ce qu'on a fait ensemble</Heading>
            {doneItems.map((item, i) => (
              <Text key={i} style={listItem}>✓&nbsp;&nbsp;{item}</Text>
            ))}
          </Section>
        )}
        {progressLabel && (
          <Section>
            <Heading as="h2" style={h2}>Où on en est</Heading>
            <Section style={barTrack}>
              <Section style={{ ...barFill, width: `${Math.min(100, Math.max(0, progressPercent))}%` }} />
            </Section>
            <Text style={barLabel}>
              {progressLabel}
              {progressCount ? ` · ${progressCount}` : ''}
            </Text>
          </Section>
        )}
        {upcomingItems.length > 0 && (
          <Section>
            <Heading as="h2" style={h2}>Ce qui arrive</Heading>
            {upcomingItems.map((item, i) => (
              <Text key={i} style={listItem}>→&nbsp;&nbsp;{item}</Text>
            ))}
          </Section>
        )}
        <Section style={{ textAlign: 'center', margin: '32px 0 16px' }}>
          <Button href={clientSpaceUrl} style={button}>
            Ouvrir mon espace
          </Button>
        </Section>
        <Text style={footer}>
          Tu reçois ce récap parce que ta mission avec Nowadays Agency est en cours.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: `On en est où ? Le point sur ta mission ✨`,
  displayName: `Récap de mission (cliente)`,
  previewData: {
    clientName: 'Marie',
    missionLabel: 'Binôme',
    recapDate: '8 août 2026',
    introText:
      "Un mois qu'on avance ensemble et franchement, ça se voit : ton positionnement est posé et tes photos donnent le ton. La suite va te plaire !",
    doneItems: [
      'Atelier positionnement (17 juillet) : artisanat poétique et engagé',
      'Audit de tes canaux livré',
    ],
    progressPercent: 64,
    progressLabel: 'À mi-chemin : ça avance fort',
    progressCount: '9/14 actions',
    upcomingItems: [
      'Atelier calendrier éditorial : mardi 12 août (J-4 !)',
      "De ton côté : tes 10 photos d'atelier, quand tu peux 😉",
    ],
    clientSpaceUrl: 'https://nowadays-mission-flow.lovable.app/client/abc-123',
  },
} satisfies TemplateEntry<Props>

/* Charte Nowadays : blanc, framboise #FB3D80, bordeaux #91014B, jaune #FFE561,
   encre #1A1A1A, gris chaud #6B5A62. Serif de titrage jamais en gras. */
const main = {
  backgroundColor: '#ffffff',
  fontFamily: '"Hanken Grotesk", -apple-system, BlinkMacSystemFont, sans-serif',
}
const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '40px 24px',
}
const h1 = {
  fontFamily: '"Instrument Serif", Georgia, serif',
  fontWeight: 'normal' as const,
  color: '#91014b',
  fontSize: '26px',
  marginBottom: '4px',
}
const h2 = {
  fontFamily: '"Instrument Serif", Georgia, serif',
  fontWeight: 'normal' as const,
  color: '#91014b',
  fontSize: '19px',
  margin: '24px 0 8px',
}
const dateline = {
  color: '#6B5A62',
  fontSize: '12px',
  margin: '0 0 16px',
}
const text = {
  color: '#1A1A1A',
  fontSize: '15px',
  lineHeight: '1.6',
}
const sticker = {
  background: '#FFE561',
  borderRadius: '6px 12px 6px 10px',
  padding: '4px 14px',
  margin: '12px 0 8px',
}
const stickerText = {
  color: '#91014b',
  fontSize: '14px',
  fontWeight: '600',
  lineHeight: '1.5',
}
const listItem = {
  color: '#1A1A1A',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '6px 0',
}
const barTrack = {
  background: '#FFD6E8',
  borderRadius: '5px',
  height: '9px',
  overflow: 'hidden' as const,
}
const barFill = {
  background: '#FB3D80',
  borderRadius: '5px',
  height: '9px',
}
const barLabel = {
  color: '#6B5A62',
  fontSize: '13px',
  margin: '8px 0 0',
}
const button = {
  background: '#FB3D80',
  color: '#ffffff',
  padding: '12px 28px',
  borderRadius: '12px',
  textDecoration: 'none',
  fontSize: '15px',
  fontWeight: '600',
  display: 'inline-block',
}
const footer = {
  color: '#6B5A62',
  fontSize: '12px',
  textAlign: 'center' as const,
  marginTop: '24px',
}
