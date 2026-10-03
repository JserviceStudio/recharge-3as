import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search, UserCircle, Phone, Calendar } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/admin/clients")({
  component: ClientsPage,
});

function ClientsPage() {
  const [search, setSearch] = useState("");

  const { data: clients, isLoading } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      // In a real scenario with full RLS and auth.users, 
      // admin should have access to a secure view or RPC.
      // For now, we fetch from a 'profiles' table if it exists, or aggregate from 'transactions'
      // Since 'profiles' table exists in the schema:
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const filteredClients = clients?.filter(c => 
    c.full_name?.toLowerCase().includes(search.toLowerCase()) || 
    c.phone?.includes(search)
  ) ?? [];

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold text-foreground">Gestion des Clients</h1>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Rechercher un nom ou numéro..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-muted-foreground">Chargement des clients...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <Card key={client.id} className="shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <UserCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground line-clamp-1">{client.full_name || "Utilisateur Inconnu"}</h3>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {client.phone || "Non renseigné"}
                    </div>
                  </div>
                </div>
                
                <div className="pt-3 border-t border-border/50 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block mb-0.5">Vérifié (KYC)</span>
                    <span className="font-medium capitalize">{client.is_verified ? "Oui" : "Non"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block mb-0.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Inscrit le
                    </span>
                    <span className="font-medium">
                      {client.created_at ? format(new Date(client.created_at), "dd MMM yyyy", { locale: fr }) : "N/A"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredClients.length === 0 && (
            <div className="col-span-full text-center py-10 text-muted-foreground">
              Aucun client trouvé.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
