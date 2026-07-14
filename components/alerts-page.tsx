"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Bell, Check, CheckCircle2, Clock3, Menu, Radio, Search, ShieldAlert, Thermometer } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { defaultMonitoringSettings, readMonitoringSettings, type MonitoringSettings } from "@/lib/monitoring-settings"

type Level="Waspada"|"Bahaya"|"Normal"
type AlertStatus="Aktif"|"Ditangani"
type AlertItem={id:number;level:Level;status:AlertStatus;temperature:number;sensorId:string;createdAt:string;title:string;detail:string}
const base=Date.UTC(2025,4,10,7,18)
const initialAlerts:AlertItem[]=[
  {id:1,level:"Waspada",status:"Aktif",temperature:29.1,sensorId:"esp32-01",createdAt:new Date(base).toISOString(),title:"Suhu mendekati batas bahaya",detail:"Periksa pendingin dan sirkulasi udara ruang server."},
  {id:2,level:"Bahaya",status:"Aktif",temperature:31.2,sensorId:"esp32-01",createdAt:new Date(base-22*60000).toISOString(),title:"Suhu melewati batas bahaya",detail:"Tindakan segera diperlukan untuk mencegah perangkat terlalu panas."},
  {id:3,level:"Normal",status:"Ditangani",temperature:26.7,sensorId:"esp32-01",createdAt:new Date(base-38*60000).toISOString(),title:"Suhu kembali normal",detail:"Suhu turun dan kembali berada dalam batas aman."},
  {id:4,level:"Waspada",status:"Ditangani",temperature:28.9,sensorId:"esp32-02",createdAt:new Date(base-63*60000).toISOString(),title:"Suhu mendekati batas bahaya",detail:"Peringatan telah diperiksa oleh operator."},
  {id:5,level:"Normal",status:"Ditangani",temperature:26.3,sensorId:"esp32-01",createdAt:new Date(base-108*60000).toISOString(),title:"Sistem mulai dimonitoring",detail:"Sensor terhubung dan pengiriman data dimulai."},
]
const dateTime=(value:string)=>new Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Bangkok",day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value))

export function AlertsPage(){
  const [settings,setSettings]=useState<MonitoringSettings>(defaultMonitoringSettings)
  const [alerts,setAlerts]=useState(initialAlerts)
  const [level,setLevel]=useState<"Semua"|Level>("Semua")
  const [status,setStatus]=useState<"Semua"|AlertStatus>("Semua")
  const [search,setSearch]=useState("")
  useEffect(()=>{const timer=setTimeout(()=>setSettings(readMonitoringSettings()),0);return()=>clearTimeout(timer)},[])
  const filtered=alerts.filter(item=>(level==="Semua"||item.level===level)&&(status==="Semua"||item.status===status)&&(item.title+item.sensorId).toLowerCase().includes(search.toLowerCase()))
  const active=alerts.filter(item=>item.status==="Aktif").length,danger=alerts.filter(item=>item.level==="Bahaya"&&item.status==="Aktif").length,handled=alerts.filter(item=>item.status==="Ditangani").length
  const acknowledge=(id:number)=>setAlerts(items=>items.map(item=>item.id===id?{...item,status:"Ditangani"}:item))
  const acknowledgeAll=()=>setAlerts(items=>items.map(item=>({...item,status:"Ditangani"})))

  return <div className="min-h-screen p-2 lg:flex">
    <aside className="sticky top-2 hidden h-[calc(100vh-1rem)] w-56 shrink-0 overflow-hidden rounded-3xl border bg-white shadow-sm lg:block"><AppSidebar/></aside>
    <main className="min-w-0 flex-1 px-2 pb-8 lg:px-6">
      <header className="flex min-h-20 items-center gap-3"><Sheet><SheetTrigger asChild><Button size="icon" variant="outline" className="lg:hidden"><Menu/></Button></SheetTrigger><SheetContent side="left" className="w-64 p-0"><SheetTitle className="sr-only">Navigasi</SheetTitle><AppSidebar/></SheetContent></Sheet><div><h1 className="text-xl font-semibold sm:text-2xl">Peringatan</h1><p className="text-sm text-slate-500">Pantau dan tindak lanjuti kejadian suhu</p></div><Button onClick={acknowledgeAll} disabled={!active} className="ml-auto bg-[#005a9c] hover:bg-[#004579]"><Check/><span className="hidden sm:inline">Tandai Semua Ditangani</span></Button></header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Summary icon={Bell} label="Peringatan Aktif" value={active} color="amber"/><Summary icon={ShieldAlert} label="Bahaya Aktif" value={danger} color="rose"/><Summary icon={CheckCircle2} label="Sudah Ditangani" value={handled} color="green"/><Summary icon={Thermometer} label="Batas Saat Ini" value={`${settings.warningTemperature}° / ${settings.dangerTemperature}°`} color="blue"/></section>

      <Card className="mt-4 shadow-sm"><CardHeader className="gap-4"><div className="flex items-center justify-between"><CardTitle>Daftar Peringatan</CardTitle><Badge variant="secondary">{filtered.length} kejadian</Badge></div><div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]"><label className="flex h-10 items-center gap-2 rounded-xl border px-3 focus-within:ring-2 focus-within:ring-emerald-500/30"><Search className="size-4 text-slate-400"/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Cari peringatan atau sensor..." className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></label><FilterGroup values={["Semua","Aktif","Ditangani"]} active={status} onChange={value=>setStatus(value as typeof status)}/><FilterGroup values={["Semua","Waspada","Bahaya","Normal"]} active={level} onChange={value=>setLevel(value as typeof level)}/></div></CardHeader>
        <CardContent className="space-y-3">{filtered.length?filtered.map(item=><AlertRow key={item.id} item={item} onAcknowledge={()=>acknowledge(item.id)}/>):<div className="grid h-48 place-items-center text-sm text-slate-400">Tidak ada peringatan yang sesuai dengan filter.</div>}</CardContent>
      </Card>
    </main>
  </div>
}

function AlertRow({item,onAcknowledge}:{item:AlertItem,onAcknowledge:()=>void}){const visual={Bahaya:{icon:ShieldAlert,box:"border-rose-200 bg-rose-50/40",bubble:"bg-rose-100 text-rose-600",badge:"bg-rose-100 text-rose-700"},Waspada:{icon:AlertTriangle,box:"border-amber-200 bg-amber-50/40",bubble:"bg-amber-100 text-amber-600",badge:"bg-amber-100 text-amber-700"},Normal:{icon:CheckCircle2,box:"border-emerald-200 bg-emerald-50/40",bubble:"bg-emerald-100 text-emerald-600",badge:"bg-emerald-100 text-emerald-700"}}[item.level],Icon=visual.icon;return <article className={`rounded-2xl border p-4 ${item.status==="Ditangani"?"border-slate-200 bg-slate-50/60":visual.box}`}><div className="flex items-start gap-4"><span className={`grid size-11 shrink-0 place-items-center rounded-full ${item.status==="Ditangani"?"bg-slate-100 text-slate-500":visual.bubble}`}><Icon className="size-5"/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{item.title}</h3><Badge className={visual.badge}>{item.level}</Badge>{item.status==="Ditangani"&&<Badge variant="outline" className="text-slate-500"><Check/>Ditangani</Badge>}</div><p className="mt-1 text-sm text-slate-500">{item.detail}</p><div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span className="flex items-center gap-1.5"><Thermometer className="size-3.5"/><b className="text-slate-700">{item.temperature.toFixed(1)}°C</b></span><span className="flex items-center gap-1.5"><Radio className="size-3.5"/>{item.sensorId}</span><span className="flex items-center gap-1.5"><Clock3 className="size-3.5"/>{dateTime(item.createdAt)} WIB</span></div></div>{item.status==="Aktif"&&<Button size="sm" variant="outline" onClick={onAcknowledge} className="shrink-0"><Check/>Tangani</Button>}</div></article>}
function Summary({icon:Icon,label,value,color}:{icon:typeof Bell,label:string,value:number|string,color:"amber"|"rose"|"green"|"blue"}){const styles={amber:"bg-amber-50 text-amber-600",rose:"bg-rose-50 text-rose-600",green:"bg-emerald-50 text-emerald-600",blue:"bg-blue-50 text-blue-600"};return <Card><CardContent className="flex items-center gap-4 p-4"><span className={`grid size-10 place-items-center rounded-full ${styles[color]}`}><Icon className="size-5"/></span><span><small className="text-slate-500">{label}</small><b className="block text-xl">{value}</b></span></CardContent></Card>}
function FilterGroup({values,active,onChange}:{values:string[],active:string,onChange:(value:string)=>void}){return <div className="flex items-center gap-1 overflow-x-auto rounded-xl border bg-white p-1">{values.map(value=><button key={value} onClick={()=>onChange(value)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs ${active===value?"bg-emerald-50 font-medium text-emerald-700":"text-slate-500 hover:bg-slate-50"}`}>{value}</button>)}</div>}
