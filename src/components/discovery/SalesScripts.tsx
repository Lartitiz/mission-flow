import { SALES_SCRIPTS } from '@/lib/discovery-data';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export function SalesScripts() {
  return (
    <Accordion type="multiple" className="space-y-2">
      {SALES_SCRIPTS.map((script, idx) => (
        <AccordionItem
          key={idx}
          value={`script-${idx}`}
          className="border-none"
        >
          <AccordionTrigger className="bg-secondary rounded-lg px-4 py-3 border-l-4 border-l-primary hover:no-underline hover:bg-secondary/80 font-body text-sm font-medium text-foreground [&[data-state=open]]:rounded-b-none">
            {script.title}
          </AccordionTrigger>
          <AccordionContent className="bg-card border border-t-0 border-border rounded-b-lg px-4 pt-3 pb-4">
            <p className="font-body text-sm leading-relaxed text-foreground/80">
              {script.content}
            </p>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
