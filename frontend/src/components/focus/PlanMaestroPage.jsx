/**
 * PlanMaestroPage — PM-DB Plan Maestro Dashboard
 * 7 tabs: Summary, Security, Migration, Decisions, Governance, Roles, Specs
 * Reads from /api/plan-maestro/* endpoints.
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { toast } from "sonner";
import api from "../../lib/api";
import SectionLayout from "./SectionLayout";
import { getSectionById } from "./focusSections";
import {
  ClipboardList,
  Shield,
  Database,
  Gavel,
  ScrollText,
  Users,
  FileText,
  RefreshCw,
  CheckCircle,
  Clock,
} from "lucide-react";

const SECTION = getSectionById("plan-maestro");

// ── Status badge colors ──────────────────────────────────────────────
const ESTADO_COLORS = {
  // Security
  "CERRADO": "bg-green-500/20 text-green-400",
  "DEPLOY ESTABLE": "bg-green-500/20 text-green-400",
  "CONDICIONADO": "bg-yellow-500/20 text-yellow-400",
  "EN CURSO": "bg-blue-500/20 text-blue-400",
  "EN DICTAMEN": "bg-purple-500/20 text-purple-400",
  "PENDIENTE": "bg-orange-500/20 text-orange-400",
  // Migration
  "NO INICIADO": "bg-slate-500/20 text-slate-400",
  "EN COLA": "bg-yellow-500/20 text-yellow-400",
  "SPEC PENDIENTE": "bg-orange-500/20 text-orange-400",
  "BLOQUEADO": "bg-red-500/20 text-red-400",
  // Decisions
  "APROBADO": "bg-green-500/20 text-green-400",
  "DELEGADO": "bg-purple-500/20 text-purple-400",
  // Specs
  "EMITIDA": "bg-blue-500/20 text-blue-400",
  "APROBADA": "bg-green-500/20 text-green-400",
  "EN DICTAMEN": "bg-purple-500/20 text-purple-400",
  "RECHAZADA": "bg-red-500/20 text-red-400",
  "SUPERSEDIDA": "bg-slate-500/20 text-slate-400",
};

const SEVERIDAD_COLORS = {
  "ALTA": "bg-red-500/20 text-red-400",
  "MEDIA": "bg-yellow-500/20 text-yellow-400",
  "BAJA": "bg-slate-500/20 text-slate-400",
};

function StatusBadge({ estado }) {
  return (
    <Badge className={`${ESTADO_COLORS[estado] || "bg-slate-500/20 text-slate-400"} border-0 text-xs`}>
      {estado}
    </Badge>
  );
}

function SeveridadBadge({ severidad }) {
  if (!severidad) return null;
  return (
    <Badge className={`${SEVERIDAD_COLORS[severidad] || "bg-slate-500/20 text-slate-400"} border-0 text-xs`}>
      {severidad}
    </Badge>
  );
}

// ── Summary Tab ──────────────────────────────────────────────────────
function SummaryTab({ summary, loading }) {
  if (loading) return <div className="text-slate-400 p-4">Loading summary...</div>;
  if (!summary) return null;

  const cards = [
    {
      title: "Security Items",
      icon: Shield,
      total: summary.security_items?.total || 0,
      breakdown: summary.security_items?.by_estado || {},
    },
    {
      title: "Migration Items",
      icon: Database,
      total: summary.migration_items?.total || 0,
      breakdown: summary.migration_items?.by_estado || {},
    },
    {
      title: "Decisions",
      icon: Gavel,
      total: summary.decisions?.total || 0,
      breakdown: summary.decisions?.by_estado || {},
    },
    {
      title: "Governance Rules",
      icon: ScrollText,
      total: summary.governance_rules?.total || 0,
      extra: `${summary.governance_rules?.activas || 0} activas`,
    },
    {
      title: "Roles",
      icon: Users,
      total: summary.roles?.total || 0,
      extra: `${summary.roles?.activos || 0} activos`,
    },
    {
      title: "Specs",
      icon: FileText,
      total: summary.spec_registry?.total || 0,
      breakdown: summary.spec_registry?.by_estado || {},
    },
  ];

  return (
    <div className="space-y-4">
      {/* Version badge */}
      {summary.changelog?.latest_version && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Clock className="w-4 h-4" />
          <span>Latest version: <strong className="text-white">{summary.changelog.latest_version}</strong></span>
          {summary.changelog.latest_date && (
            <span>· {summary.changelog.latest_date}</span>
          )}
        </div>
      )}

      {/* Summary cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="bg-slate-900/50 border-slate-700/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-300">{card.title}</span>
                </div>
                <div className="text-2xl font-bold text-white mb-1">{card.total}</div>
                {card.extra && (
                  <div className="text-xs text-slate-400">{card.extra}</div>
                )}
                {card.breakdown && Object.keys(card.breakdown).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(card.breakdown).map(([estado, count]) => (
                      <span key={estado} className="text-xs text-slate-500">
                        {estado}: {count}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── Generic Data Table ───────────────────────────────────────────────
function DataTable({ columns, data, loading, emptyMessage = "No data found." }) {
  if (loading) return <div className="text-slate-400 p-4">Loading...</div>;
  if (!data || data.length === 0) {
    return <div className="text-slate-500 p-4 text-center">{emptyMessage}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700/50">
            {columns.map((col) => (
              <th key={col.key} className="text-left p-3 text-slate-400 font-medium text-xs uppercase tracking-wider">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id || row.codigo || row.numero || row.rol_id || row.codigo_spec || i}
                className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className="p-3 text-slate-300">
                  {col.render ? col.render(row[col.key], row) : (row[col.key] || "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tab Configurations ───────────────────────────────────────────────
const securityColumns = [
  { key: "codigo", label: "Código", render: (v) => <span className="font-mono text-orange-400">{v}</span> },
  { key: "severidad", label: "Severidad", render: (v) => <SeveridadBadge severidad={v} /> },
  { key: "descripcion", label: "Descripción", render: (v) => <span className="max-w-xs truncate block">{v}</span> },
  { key: "estado", label: "Estado", render: (v) => <StatusBadge estado={v} /> },
  { key: "dependencias", label: "Dependencias" },
  { key: "notas", label: "Notas", render: (v) => v ? <span className="max-w-xs truncate block text-slate-500 text-xs">{v}</span> : "—" },
];

const migrationColumns = [
  { key: "codigo", label: "Código", render: (v) => <span className="font-mono text-orange-400">{v}</span> },
  { key: "dominio", label: "Dominio" },
  { key: "volumen_estimado", label: "Volumen" },
  { key: "complejidad", label: "Complejidad", render: (v) => v ? <Badge className="bg-slate-700/50 text-slate-300 border-0 text-xs">{v}</Badge> : "—" },
  { key: "estado", label: "Estado", render: (v) => <StatusBadge estado={v} /> },
  { key: "notas", label: "Notas", render: (v) => v ? <span className="max-w-xs truncate block text-slate-500 text-xs">{v}</span> : "—" },
];

const decisionColumns = [
  { key: "codigo", label: "Código", render: (v) => <span className="font-mono text-orange-400">{v}</span> },
  { key: "descripcion", label: "Descripción", render: (v) => <span className="max-w-sm truncate block">{v}</span> },
  { key: "resolucion", label: "Resolución", render: (v) => v ? <span className="max-w-sm truncate block text-xs">{v}</span> : "—" },
  { key: "estado", label: "Estado", render: (v) => <StatusBadge estado={v} /> },
  { key: "fecha", label: "Fecha" },
];

const governanceColumns = [
  { key: "numero", label: "#", render: (v) => <span className="font-mono text-orange-400">{v}</span> },
  { key: "texto", label: "Regla", render: (v) => <span className="max-w-lg block text-sm">{v}</span> },
  { key: "activa", label: "Activa", render: (v) => v ? <CheckCircle className="w-4 h-4 text-green-400" /> : <span className="text-slate-600">—</span> },
  { key: "fecha_vigencia", label: "Vigencia" },
];

const roleColumns = [
  { key: "rol_id", label: "ID", render: (v) => <span className="font-mono text-orange-400">{v}</span> },
  { key: "nombre", label: "Nombre" },
  { key: "funcion", label: "Función", render: (v) => <span className="max-w-sm truncate block text-xs">{v}</span> },
  { key: "activo", label: "Activo", render: (v) => v ? <CheckCircle className="w-4 h-4 text-green-400" /> : <span className="text-red-400">Inactivo</span> },
  { key: "unidades", label: "Unidades", render: (v) => v && v.length > 0 ? v.join(", ") : "—" },
];

const specColumns = [
  { key: "codigo_spec", label: "Código", render: (v) => <span className="font-mono text-orange-400">{v}</span> },
  { key: "titulo", label: "Título", render: (v) => <span className="max-w-sm truncate block">{v}</span> },
  { key: "version", label: "Ver" },
  { key: "autor", label: "Autor" },
  { key: "estado", label: "Estado", render: (v) => <StatusBadge estado={v} /> },
  { key: "destinatarios", label: "Destinatarios", render: (v) => v && v.length > 0 ? v.join(", ") : "—" },
];

const changelogColumns = [
  { key: "version_desde", label: "Desde", render: (v) => <span className="font-mono">{v}</span> },
  { key: "version_hasta", label: "Hasta", render: (v) => <span className="font-mono text-orange-400">{v}</span> },
  { key: "fecha", label: "Fecha" },
  { key: "redactor", label: "Redactor" },
  { key: "items", label: "Items", render: (v) => {
    if (!v || !Array.isArray(v)) return "—";
    return (
      <ul className="list-disc list-inside text-xs text-slate-400 max-w-lg">
        {v.slice(0, 3).map((item, i) => <li key={i} className="truncate">{item}</li>)}
        {v.length > 3 && <li className="text-slate-600">+{v.length - 3} more</li>}
      </ul>
    );
  }},
];

// ── Main Component ───────────────────────────────────────────────────
export default function PlanMaestroPage() {
  const [activeTab, setActiveTab] = useState("summary");
  const [summary, setSummary] = useState(null);
  const [securityItems, setSecurityItems] = useState([]);
  const [migrationItems, setMigrationItems] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [governanceRules, setGovernanceRules] = useState([]);
  const [changelog, setChangelog] = useState([]);
  const [roles, setRoles] = useState([]);
  const [specs, setSpecs] = useState([]);
  const [loading, setLoading] = useState({});
  const [trafficStatus, setTrafficStatus] = useState("gray");

  const loadSummary = useCallback(async () => {
    setLoading((p) => ({ ...p, summary: true }));
    try {
      const res = await api.get("/plan-maestro/summary");
      setSummary(res.data);
      // Compute traffic light
      const secEstados = res.data?.security_items?.by_estado || {};
      const hasHighSec = (secEstados["EN CURSO"] || 0) + (secEstados["PENDIENTE"] || 0) > 0;
      const migEstados = res.data?.migration_items?.by_estado || {};
      const hasBlocked = (migEstados["BLOQUEADO"] || 0) > 0;
      const decEstados = res.data?.decisions?.by_estado || {};
      const hasPending = (decEstados["PENDIENTE"] || 0) > 0;
      if (hasHighSec) setTrafficStatus("red");
      else if (hasBlocked || hasPending) setTrafficStatus("yellow");
      else setTrafficStatus("green");
    } catch (err) {
      console.error("Error loading summary:", err);
      toast.error("Failed to load Plan Maestro summary");
    } finally {
      setLoading((p) => ({ ...p, summary: false }));
    }
  }, []);

  const loadTab = useCallback(async (tab) => {
    const endpoints = {
      security: { url: "/plan-maestro/security-items", setter: setSecurityItems, key: "items" },
      migration: { url: "/plan-maestro/migration-items", setter: setMigrationItems, key: "items" },
      decisions: { url: "/plan-maestro/decisions", setter: setDecisions, key: "items" },
      governance: { url: "/plan-maestro/governance-rules", setter: setGovernanceRules, key: "items" },
      changelog: { url: "/plan-maestro/changelog", setter: setChangelog, key: "items" },
      roles: { url: "/plan-maestro/roles", setter: setRoles, key: "items" },
      specs: { url: "/plan-maestro/specs", setter: setSpecs, key: "items" },
    };
    const config = endpoints[tab];
    if (!config) return;

    setLoading((p) => ({ ...p, [tab]: true }));
    try {
      const res = await api.get(config.url);
      config.setter(res.data?.[config.key] || res.data || []);
    } catch (err) {
      console.error(`Error loading ${tab}:`, err);
      toast.error(`Failed to load ${tab}`);
    } finally {
      setLoading((p) => ({ ...p, [tab]: false }));
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (activeTab !== "summary") {
      loadTab(activeTab);
    }
  }, [activeTab, loadTab]);

  const handleRefresh = () => {
    loadSummary();
    if (activeTab !== "summary") loadTab(activeTab);
    toast.success("Refreshed");
  };

  return (
    <SectionLayout
      title={SECTION.label}
      subheadline={SECTION.subheadline}
      steps={SECTION.steps}
      trafficRules={SECTION.trafficRules}
      isDaily={false}
      currentStatus={trafficStatus}
      icon={ClipboardList}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-orange-400" />
          <h2 className="text-lg font-semibold text-white">Plan Maestro v7.14</h2>
          <Badge className="bg-slate-700/50 text-slate-400 border-0 text-xs">7 tablas · 74 registros</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} className="text-slate-400 hover:text-white">
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-800/50 border border-slate-700/50 w-full justify-start flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="summary" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-xs">
            📊 Resumen
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-xs">
            🛡️ Security ({summary?.security_items?.total || "…"})
          </TabsTrigger>
          <TabsTrigger value="migration" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-xs">
            🗄️ Migration ({summary?.migration_items?.total || "…"})
          </TabsTrigger>
          <TabsTrigger value="decisions" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-xs">
            ⚖️ Decisions ({summary?.decisions?.total || "…"})
          </TabsTrigger>
          <TabsTrigger value="governance" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-xs">
            📜 Governance ({summary?.governance_rules?.total || "…"})
          </TabsTrigger>
          <TabsTrigger value="roles" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-xs">
            👥 Roles ({summary?.roles?.total || "…"})
          </TabsTrigger>
          <TabsTrigger value="specs" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-xs">
            📄 Specs ({summary?.spec_registry?.total || "…"})
          </TabsTrigger>
          <TabsTrigger value="changelog" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400 text-xs">
            📝 Changelog ({summary?.changelog?.total || "…"})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4">
          <SummaryTab summary={summary} loading={loading.summary} />
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-0">
              <DataTable columns={securityColumns} data={securityItems} loading={loading.security} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="migration" className="mt-4">
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-0">
              <DataTable columns={migrationColumns} data={migrationItems} loading={loading.migration} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decisions" className="mt-4">
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-0">
              <DataTable columns={decisionColumns} data={decisions} loading={loading.decisions} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="governance" className="mt-4">
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-0">
              <DataTable columns={governanceColumns} data={governanceRules} loading={loading.governance} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-0">
              <DataTable columns={roleColumns} data={roles} loading={loading.roles} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="specs" className="mt-4">
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-0">
              <DataTable columns={specColumns} data={specs} loading={loading.specs} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="changelog" className="mt-4">
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="p-0">
              <DataTable columns={changelogColumns} data={changelog} loading={loading.changelog} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </SectionLayout>
  );
}
