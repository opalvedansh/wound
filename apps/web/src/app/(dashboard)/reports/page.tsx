"use client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { motion } from "motion/react";
import { FileText, Download, FileJson } from "lucide-react";

export default function ReportsPage() {
  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-10">
      <motion.div variants={item}>
        <h2 className="text-3xl font-bold tracking-tight">Reports & Export</h2>
        <p className="text-muted-foreground mt-2">Generate clinical summaries and export EHR-ready data</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mb-4">
                <FileText className="w-6 h-6" />
              </div>
              <CardTitle>Clinical Reports</CardTitle>
              <CardDescription>Generate PDF reports for patients and cases</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <p className="text-sm text-muted-foreground leading-relaxed">
                 Select a patient or case from the dashboard to generate an individualized treatment timeline report, including flagged issues, clinical notes, and AI confidence scores.
               </p>
               <Button variant="outline" className="w-full rounded-full h-12">
                 <Download className="w-4 h-4 mr-2" />
                 Generate Clinic Summary (PDF)
               </Button>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="h-full">
            <CardHeader>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0 mb-4">
                <FileJson className="w-6 h-6" />
              </div>
              <CardTitle>Approved Data Export</CardTitle>
              <CardDescription>Export structured data for EHR integration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <p className="text-sm text-muted-foreground leading-relaxed">
                 Export HIPAA-compliant de-identified or full patient data sets in CSV or JSON format. These can be directly ingested into major Electronic Health Record systems.
               </p>
               <div className="flex gap-4">
                  <Button variant="outline" className="flex-1 rounded-full h-12">Export CSV</Button>
                  <Button variant="outline" className="flex-1 rounded-full h-12">Export JSON</Button>
               </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
