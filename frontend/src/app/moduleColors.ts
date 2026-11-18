export const moduleColors={
 passed:'bg-green-50 border-green-300',
 available:'bg-white border-gray-300',
 locked:'bg-gray-100 border-gray-200',
 planned:'bg-blue-50 border-blue-300',
 failed:'bg-orange-50 border-orange-400',
};
export const moduleLegend=[
 [moduleColors.passed,'Bestanden'],[moduleColors.available,'Verfügbar'],
 [moduleColors.locked,'Gesperrt'],[moduleColors.planned,'Eingeplant'],
 [moduleColors.failed,'Nicht bestanden / Wiederholung'],
];
