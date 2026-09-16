"use client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { useWebStore } from "../../../lib/mockStore";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { UserPlus } from "lucide-react";

export default function RegistrationPage() {
  const { addPatient } = useWebStore();
  const router = useRouter();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    patientId: '',
    sex: 'M',
    dob: '',
    location: 'Clinic A'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addPatient({
      firstName: formData.firstName,
      lastName: formData.lastName,
      patientId: formData.patientId,
      sex: formData.sex as 'M' | 'F' | 'O',
      dob: formData.dob,
      location: formData.location
    });
    router.push('/patients');
  };

  const container = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="max-w-2xl mx-auto py-8">
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-black/5 dark:border-white/5 pb-8 pt-8 px-8">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6">
            <UserPlus className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl">Register New Patient</CardTitle>
          <CardDescription className="text-base mt-2">Enter patient details to enroll them into the clear aligner system.</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground">First Name</label>
                <input required type="text" className="flex h-11 w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} placeholder="e.g. Jane" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground">Last Name</label>
                <input required type="text" className="flex h-11 w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} placeholder="e.g. Doe" />
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-foreground">MRN / Patient ID</label>
              <input required type="text" className="flex h-11 w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all" value={formData.patientId} onChange={e => setFormData({...formData, patientId: e.target.value})} placeholder="e.g. PT-10025" />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground">Date of Birth</label>
                <input required type="date" className="flex h-11 w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground">Biological Sex</label>
                <select className="flex h-11 w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all" value={formData.sex} onChange={e => setFormData({...formData, sex: e.target.value})}>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-foreground">Primary Clinic / Location</label>
              <input required type="text" className="flex h-11 w-full rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="e.g. Main Street Ortho" />
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-black/5 dark:border-white/5">
              <Button variant="ghost" className="rounded-full px-6" type="button" onClick={() => router.back()}>Cancel</Button>
              <Button type="submit" className="rounded-full px-8 shadow-md">Complete Registration</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
