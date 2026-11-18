import { FileText } from 'lucide-react';
export function LeistungenHelp({ open = false }: { open?:boolean }) {
 return <details open={open || undefined} className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 text-sm text-blue-950">
  <summary className="cursor-pointer font-medium"><FileText size={16} className="inline mr-2"/>PDF aus HISinOne erstellen</summary>
  <LeistungenInstructions/>
 </details>;
}

export function LeistungenInstructions() { return <div className="text-sm text-blue-950">
  <ol className="list-decimal pl-5 space-y-2 mt-3">
   <li>In HISinOne „Mein Studium → Leistungen“ öffnen.</li>
   <li>Unter „Leistungsdaten“ auf „Alle aufklappen“ klicken. <strong>Wichtig: Wenn der untere Block „Studienverlauf“ aufgeklappt ist, diesen separat einklappen.</strong></li>
   <li>Den Druckdialog der Seite öffnen: mit <strong>Strg + P</strong> (Windows/Linux) bzw. <strong>⌘ + P</strong> (Mac), über das Browsermenü „Drucken“ oder, falls im Browser verfügbar, per Rechtsklick auf die Seite → „Drucken“. Anschließend „Als PDF speichern“ bzw. „Als PDF sichern“ wählen. Hintergrund drucken einschalten, Kopf- und Fußzeilen ausschalten.</li>
   <li>In der Vorschau alle Seiten prüfen: Tabelle ohne Überdeckung, Titel, Nummer, Versuch, Rücktritt, Bewertung, Bonus, Malus und Status vollständig sichtbar. Bei Bedarf Maßstab oder Ausrichtung anpassen.</li>
  </ol>
  <p className="mt-3">Eine Datei genügt. Bitte die Leistungen-Tabelle exportieren, keine Notenbestätigung und keinen Screenshot. Ohne erste Ergebnisse kannst du deinen Studienplan auch ohne PDF öffnen.</p>
</div>; }
