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
  sessionDate?: string
  sessionLabel?: string
  clientSpaceUrl?: string
}

const Email = ({
  clientName = '',
  sessionDate = '',
  sessionLabel = '',
  clientSpaceUrl = '#',
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Le résumé de notre atelier est en ligne dans ton espace ✨</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {sessionLabel
            ? `Atelier ${sessionLabel} : le résumé t'attend`
            : `Ton atelier : le résumé t'attend`}
        </Heading>
        {clientName && <Text style={text}>Hello {clientName},</Text>}
        <Text style={text}>
          Le résumé de notre atelier{sessionDate ? ` du ${sessionDate}` : ''} est en
          ligne dans ton espace : ce qu'on a décidé, et tes prochaines actions.
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={clientSpaceUrl} style={button}>
            Ouvrir mon espace
          </Button>
        </Section>
        <Text style={footer}>
          Tu reçois cet e-mail parce qu'un résumé d'atelier vient d'être publié dans
          ton espace client Nowadays Agency.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: `Ton résumé d'atelier est en ligne ✨`,
  displayName: `Résumé d'atelier publié (cliente)`,
  previewData: {
    clientName: 'Marie',
    sessionDate: '7 août 2026',
    sessionLabel: 'stratégie de contenu',
    clientSpaceUrl: 'https://nowadays-mission-flow.lovable.app/client/abc-123',
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
