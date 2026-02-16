import { Users, Globe, ShieldX, ArrowUpRight } from "lucide-react";
import { tenants } from "@/lib/mock-data";
import { motion } from "framer-motion";

export default function Tenants() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manage multi-tenant DNS filtering configurations</p>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          + Add Tenant
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tenants.map((tenant, i) => (
          <motion.div
            key={tenant.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-lg p-5 hover:border-primary/30 transition-colors group"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{tenant.name}</h3>
              <button className="text-muted-foreground hover:text-primary transition-colors">
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Users className="h-3.5 w-3.5" />
                  <span className="text-[10px] uppercase tracking-wider">Users</span>
                </div>
                <p className="font-mono font-bold">{tenant.users}</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Globe className="h-3.5 w-3.5" />
                  <span className="text-[10px] uppercase tracking-wider">Queries</span>
                </div>
                <p className="font-mono font-bold">{(tenant.queries / 1000).toFixed(0)}K</p>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <ShieldX className="h-3.5 w-3.5" />
                  <span className="text-[10px] uppercase tracking-wider">Blocked</span>
                </div>
                <p className="font-mono font-bold text-destructive">{(tenant.blocked / 1000).toFixed(0)}K</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
