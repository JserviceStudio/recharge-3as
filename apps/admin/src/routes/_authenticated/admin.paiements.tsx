import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/paiements")({
  component: PaiementsAdmin,
});

const PROVIDERS = [
  { value: "mtn_momo", label: "MTN Mobile Money" },
  { value: "moov_money", label: "Moov Money" },
  { value: "celtiis_cash", label: "Celtiis Cash" },
  { value: "other", label: "Autre" },
];

function PaiementsAdmin() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", provider: "mtn_momo", agent_number: "" });

  const { data } = useQuery({
    queryKey: ["all-payment-methods"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_methods").select("*").order("created_at");
      return data ?? [];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await supabase.from("payment_methods").update({ active }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-payment-methods"] }),
  });

  const updateNumber = useMutation({
    mutationFn: async ({ id, agent_number }: { id: string; agent_number: string }) => {
      await supabase.from("payment_methods").update({ agent_number }).eq("id", id);
    },
    onSuccess: () => {
      toast.success("Numéro mis à jour");
      qc.invalidateQueries({ queryKey: ["all-payment-methods"] });
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.agent_number) throw new Error("Champs manquants");
      const { error } = await supabase.from("payment_methods").insert({
        name: form.name, provider: form.provider as any, agent_number: form.agent_number, active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Moyen ajouté");
      setForm({ name: "", provider: "mtn_momo", agent_number: "" });
      setAdding(false);
      qc.invalidateQueries({ queryKey: ["all-payment-methods"] });
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("payment_methods").delete().eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-payment-methods"] }),
  });

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Moyens de paiement</h2>
        <Button size="sm" onClick={() => setAdding(!adding)}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </div>

      {adding && (
        <Card><CardContent className="p-4 space-y-3">
          <div className="space-y-1"><Label className="text-xs">Nom affiché</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="MTN Mobile Money" />
          </div>
          <div className="space-y-1"><Label className="text-xs">Fournisseur</Label>
            <Select value={form.provider} onValueChange={(v) => setForm({ ...form, provider: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Numéro agent</Label>
            <Input value={form.agent_number} onChange={(e) => setForm({ ...form, agent_number: e.target.value })} placeholder="+229 00 00 00 00" />
          </div>
          <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full">
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Enregistrer
          </Button>
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {data?.map((m) => (
          <Card key={m.id} className="shadow-card">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{m.name}</div>
                <div className="flex items-center gap-2">
                  <Switch checked={m.active} onCheckedChange={(checked) => toggleActive.mutate({ id: m.id, active: checked })} />
                  <button onClick={() => remove.mutate(m.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Numéro</Label>
                <Input
                  defaultValue={m.agent_number}
                  onBlur={(e) => {
                    if (e.target.value !== m.agent_number) updateNumber.mutate({ id: m.id, agent_number: e.target.value });
                  }}
                  className="font-mono"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
