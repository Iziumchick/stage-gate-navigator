import { ArrowLeft } from 'lucide-react';
import { Brand } from './FirstVisit';
import { PrivacyContent, ResearchFooter, usePrivacyNotice } from './Privacy';

export function LegalPage() {
  const {info, loading, error} = usePrivacyNotice();
  const imprint = window.location.pathname === '/impressum';
  return <div className="min-h-screen bg-gray-50">
    <header className="border-b bg-white px-8 py-6 flex flex-wrap gap-4 justify-between items-center"><Brand/><a href="/" className="action-button"><ArrowLeft size={16}/>Zur Startseite</a></header>
    <main className="max-w-3xl mx-auto px-6 py-10">
      <article className="rounded-2xl border bg-white p-8">
        <h1 className="text-3xl">{imprint ? 'Impressum' : 'Datenschutz & Projektinformation'}</h1>
        {loading ? <p role="status" className="mt-6">Angaben werden geladen …</p> : error ? <p role="alert" className="mt-6 text-red-700">{error}</p> : imprint ? <div className="space-y-6 mt-6 text-sm leading-relaxed">
          {(!info.controller || !info.address || !info.contact) && <p className="rounded bg-amber-50 p-3">Die Betreiberangaben müssen vor einer öffentlichen Freigabe vervollständigt werden.</p>}
          <section><h2 className="text-lg font-medium">Betreiber und Kontakt</h2><p className="mt-2 whitespace-pre-line">{info.controller || 'Name noch zu ergänzen.'}<br/>{info.address || 'Postanschrift noch zu ergänzen.'}<br/>{info.contact || 'Kontakt noch zu ergänzen.'}</p></section>
          <section><h2 className="text-lg font-medium">Über dieses Projekt</h2><p className="mt-2">Study Navigator ist ein privat betriebenes Projekt im Rahmen einer Bachelorarbeit. Die OTH Regensburg und ihre Fakultäten sind nicht Betreiber dieses Dienstes. Die Anwendung ist kein offizielles Hochschulangebot.</p></section>
          <section><h2 className="text-lg font-medium">Studienplanung</h2><p className="mt-2">Der Überblick unterstützt die persönliche Planung. Verbindliche Prüfungsanmeldungen, Zulassungen und individuelle Entscheidungen erfolgen über die zuständigen Stellen der Hochschule.</p></section>
          <p>Informationen zur Verarbeitung und Löschung von Daten findest du in der <a href="/datenschutz" className="text-blue-700 underline">Datenschutzerklärung</a>.</p>
        </div> : <PrivacyContent info={info}/>}
      </article>
    </main>
    <ResearchFooter/>
  </div>;
}
