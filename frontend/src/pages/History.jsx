import { useEffect, useState } from "react";
import { getEmailLogs } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { 
  History as HistoryIcon, 
  Mail,
  Eye,
  MousePointer,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";

export default function History() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const response = await getEmailLogs(100, 0);
      setLogs(response.data.logs);
      setTotal(response.data.total);
    } catch (error) {
      console.error("Error loading logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status, openedAt, clickedAt) => {
    if (clickedAt) {
      return (
        <Badge className="badge-success flex items-center gap-1">
          <MousePointer className="w-3 h-3" />
          Clic
        </Badge>
      );
    }
    if (openedAt) {
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-200 flex items-center gap-1">
          <Eye className="w-3 h-3" />
          Abierto
        </Badge>
      );
    }
    if (status === 'sent') {
      return (
        <Badge className="badge-neutral flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Enviado
        </Badge>
      );
    }
    if (status === 'failed') {
      return (
        <Badge className="badge-error flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          Error
        </Badge>
      );
    }
    return (
      <Badge className="badge-warning flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Pendiente
      </Badge>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-8" data-testid="history-page">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-black text-white tracking-tight">Historial de Envíos</h1>
        <p className="text-slate-500 mt-1">{total} emails en el historial</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total enviados</p>
                <p className="text-2xl font-bold text-white">
                  {logs.filter(l => l.status === 'sent').length}
                </p>
              </div>
              <div className="p-3 bg-[#151515] rounded-xl">
                <Mail className="w-5 h-5 text-slate-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Abiertos</p>
                <p className="text-2xl font-bold text-blue-600">
                  {logs.filter(l => l.opened_at).length}
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl">
                <Eye className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Con clics</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {logs.filter(l => l.clicked_at).length}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl">
                <MousePointer className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="stat-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Tasa de apertura</p>
                <p className="text-2xl font-bold text-orange-600">
                  {logs.length > 0 
                    ? Math.round((logs.filter(l => l.opened_at).length / logs.filter(l => l.status === 'sent').length) * 100) || 0
                    : 0}%
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-xl">
                <HistoryIcon className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card className="stat-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <HistoryIcon className="w-5 h-5 text-slate-300" />
            Registro de Emails
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-[#222222] border-t-slate-600 rounded-full mx-auto" />
              <p className="text-slate-500 mt-4">Cargando historial...</p>
            </div>
          ) : logs.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold">Destinatario</TableHead>
                    <TableHead className="font-semibold">Asunto</TableHead>
                    <TableHead className="font-semibold">Estado</TableHead>
                    <TableHead className="font-semibold">Enviado</TableHead>
                    <TableHead className="font-semibold">Abierto</TableHead>
                    <TableHead className="font-semibold">Clic</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow 
                      key={log.id} 
                      className="table-row-hover"
                      data-testid={`email-log-${log.id}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-[#151515] rounded-full flex items-center justify-center">
                            <Mail className="w-4 h-4 text-slate-500" />
                          </div>
                          <span className="font-medium text-white">
                            {log.recipient_email || "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-300 truncate max-w-xs block">
                          {log.subject || "-"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(log.status, log.opened_at, log.clicked_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-slate-500 text-sm">
                          <Clock className="w-3 h-3" />
                          {formatDate(log.sent_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.opened_at ? (
                          <div className="flex items-center gap-1 text-blue-600 text-sm">
                            <Eye className="w-3 h-3" />
                            {formatDate(log.opened_at)}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.clicked_at ? (
                          <div className="flex items-center gap-1 text-emerald-600 text-sm">
                            <MousePointer className="w-3 h-3" />
                            {formatDate(log.clicked_at)}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <HistoryIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-semibold text-white mb-2">Sin historial</h3>
              <p className="text-slate-500">
                Los emails enviados aparecerán aquí
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
