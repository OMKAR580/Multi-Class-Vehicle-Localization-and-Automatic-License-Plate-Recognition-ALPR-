'use client';

import React, { useState } from 'react';
import {
  Compass,
  ArrowRight,
  ShieldCheck,
  Car,
  Truck,
  Building2,
  Camera,
  Activity,
  CheckCircle2,
  Cpu,
  Layers,
  SlidersHorizontal,
  Workflow,
  Eye,
  Lock,
  Radio,
  FileCheck2,
} from 'lucide-react';

interface EnterpriseApplicationsSectionProps {
  theme?: 'dark' | 'beige';
}

type ApplicationId = 'traffic' | 'infrastructure' | 'parking' | 'security';

interface ApplicationCategory {
  id: ApplicationId;
  index: string;
  badge: string;
  title: string;
  subtitle: string;
  tagline: string;
  imageSrc: string;
  imageAlt: string;
  description: string;
  workflows: string[];
  integrationSpecs: { label: string; value: string }[];
  deploymentNotice: string;
  accentColor: 'emerald' | 'amber' | 'sky' | 'indigo';
}

const APPLICATIONS: ApplicationCategory[] = [
  {
    id: 'traffic',
    index: '01',
    badge: 'SMART TRAFFIC & CONGESTION',
    title: 'Smart Traffic Management',
    subtitle: 'Urban Corridor & Intersection Intelligence',
    tagline: 'Multi-class vehicle observation to support municipal traffic engineering and congestion mitigation.',
    imageSrc: '/assets/real_highway_road.jpg',
    imageAlt: 'Highway traffic observation corridor with VisionPlate AI reticle overlay',
    description:
      'Dense Indian roadways require high-tolerance vehicle detection capable of handling heterogeneous traffic flows. VisionPlate AI supports automated vehicle counting, road usage distribution analysis, and lane density monitoring across complex urban intersections.',
    workflows: [
      'Real-time traffic volume & density observation across multi-lane corridors',
      'Modal split analysis (separating private cars, commercial freight, 2-wheelers, and auto-rickshaws)',
      'Junction queuing assessment to inform adaptive signal timing systems',
      'Continuous roadside sensor logging without manual headcount intervention',
    ],
    integrationSpecs: [
      { label: 'Camera Protocol', value: 'RTSP / ONVIF IP Streams (1080p)' },
      { label: 'Classification', value: '8 Indian Roadway Categories' },
      { label: 'Data Dispatch', value: 'Structured JSON via Webhooks & MQTT' },
      { label: 'Environment', value: 'Urban Arterials & Signalized Junctions' },
    ],
    deploymentNotice: 'Potential deployment application requiring municipal sensor connectivity and edge/cloud integration.',
    accentColor: 'emerald',
  },
  {
    id: 'infrastructure',
    index: '02',
    badge: 'TRANSPORTATION INFRASTRUCTURE',
    title: 'Intelligent Transportation Infrastructure',
    subtitle: 'Highway Tolling & Free-Flow Corridors',
    tagline: 'High-speed vehicle classification and plate localization for national highways and transit plazas.',
    imageSrc: '/assets/real_truck.jpg',
    imageAlt: 'Heavy commercial freight carrier localized on transit corridor',
    description:
      'National highway networks depend on rapid vehicle localization and automated license plate verification. VisionPlate AI extracts geometric boundaries and Indian high-security registration plates (HSRP) to assist tolling infrastructure, freight bypasses, and weight-station checkpoints.',
    workflows: [
      'High-speed vehicle boundary localization before gantry entry barriers',
      'Plate localization & perspective rectification under harsh optical lighting',
      'Freight vs passenger vehicle classification to support differentiated tolling tiers',
      'Validation against standard 37 State and Union Territory RTO syntax formats',
    ],
    integrationSpecs: [
      { label: 'Mounting Geometry', value: 'Overhead Gantry & Roadside Poles' },
      { label: 'Target Output', value: 'Vehicle Class + Plate ROI + Timestamp' },
      { label: 'Downstream Sync', value: 'Tolling ERP / FASTag Middleware' },
      { label: 'Optical Tolerance', value: 'Daylight, Glare & Low-Light Sensors' },
    ],
    deploymentNotice: 'Potential integration framework for highway concessionaires, weigh-stations, and transit plazas.',
    accentColor: 'amber',
  },
  {
    id: 'parking',
    index: '03',
    badge: 'ACCESS AUTOMATION',
    title: 'Parking & Vehicle Access Management',
    subtitle: 'Commercial Campuses & High-Volume Garages',
    tagline: 'Seamless vehicle identification workflows for automated boom barriers and commercial facilities.',
    imageSrc: '/assets/real_nexon_ev.jpg',
    imageAlt: 'Passenger electric vehicle at facility gatehouse checkpoint',
    description:
      'Eliminate ticketing friction at enterprise campuses, tech parks, shopping malls, and residential developments. VisionPlate AI localizes incoming vehicles and extracts license plates to verify tenant credentials and accelerate vehicle ingress and egress.',
    workflows: [
      'Automated barrier gate trigger via sub-pixel license plate recognition',
      'Authorized tenant, fleet vehicle, and pre-registered visitor verification',
      'Real-time bay occupancy accounting and parking turnover telemetry',
      'Historical access timestamp and vehicle image audit logs for property security',
    ],
    integrationSpecs: [
      { label: 'Mounting Angle', value: 'Gatehouse Curb Cameras (15° - 35° tilt)' },
      { label: 'Recognition Engine', value: 'YOLOv8 + PaddleOCR Pipeline' },
      { label: 'Interface', value: 'REST API & Barrier Relay Triggers' },
      { label: 'Turnaround Latency', value: 'Sub-second plate verification loop' },
    ],
    deploymentNotice: 'Operational workflow for commercial properties requiring physical gatehouse hardware & barrier controller relays.',
    accentColor: 'sky',
  },
  {
    id: 'security',
    index: '04',
    badge: 'OPERATIONAL SECURITY',
    title: 'Security & Operational Intelligence',
    subtitle: 'Perimeter Observation & Audit Telemetry',
    tagline: 'CCTV-assisted vehicle logging and structured detection records for security control rooms.',
    imageSrc: '/assets/real_suv.jpg',
    imageAlt: 'Security observation frame with vehicle boundary tracking',
    description:
      'Assist physical security and facilities teams with verified digital audit trails of vehicle activity across facility perimeters. VisionPlate AI transforms unstructured video feeds into searchable chronological records of vehicle types, plate numbers, and transit times.',
    workflows: [
      'Perimeter CCTV vehicle logging without manual clipboard recording',
      'Structured vehicle record delivery (class, timestamp, cropped plate evidence)',
      'Searchable historical audit trails for internal operations and incident review',
      'Integration with security operations center (SOC) dashboards and alert queues',
    ],
    integrationSpecs: [
      { label: 'System Ingest', value: 'Multi-Channel Security NVR / VMS Feeds' },
      { label: 'Data Model', value: 'Strict Pydantic v2 Event Schema' },
      { label: 'Search Index', value: 'State Code, RTO Region & Plate Characters' },
      { label: 'Safety Policy', value: 'Operator-in-the-loop audit verification' },
    ],
    deploymentNotice: 'Supports human operators with observation telemetry; does not provide automated threat detection or identity verification.',
    accentColor: 'indigo',
  },
];

export default function EnterpriseApplicationsSection({
  theme = 'dark',
}: EnterpriseApplicationsSectionProps) {
  const isDark = theme === 'dark';
  const [selectedAppId, setSelectedAppId] = useState<ApplicationId>('traffic');

  const selectedApp = APPLICATIONS.find((app) => app.id === selectedAppId) || APPLICATIONS[0];

  return (
    <section
      id="enterprise-applications"
      className={`relative pt-16 sm:pt-20 lg:pt-28 pb-20 sm:pb-28 lg:pb-36 transition-colors duration-400 overflow-hidden ${
        isDark ? 'bg-[#050505] text-white' : 'bg-[#E3D9C3] text-[#1A1815]'
      }`}
    >
      {/* Subtle Background Glow Accent */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] sm:w-[950px] h-[500px] rounded-full blur-[140px] transition-opacity duration-700 ${
            isDark ? 'bg-amber-500/[0.03]' : 'bg-amber-700/[0.04]'
          }`}
        />
        <div
          className={`absolute bottom-10 left-1/4 w-[500px] h-[350px] rounded-full blur-[120px] transition-opacity duration-700 ${
            isDark ? 'bg-emerald-500/[0.025]' : 'bg-emerald-700/[0.035]'
          }`}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* =================================================================== */}
        {/* 1. EDITORIAL HEADER & STRATEGIC POSITIONING                         */}
        {/* =================================================================== */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16 space-y-4">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono font-bold tracking-widest uppercase transition-all duration-300 shadow-sm backdrop-blur-md">
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${
                isDark ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-[#B27D22] shadow-[0_0_6px_#b27d22]'
              }`}
            />
            <span className={isDark ? 'text-amber-400/90' : 'text-[#8A6318]'}>
              ENTERPRISE APPLICATIONS // SECTION 05
            </span>
            <span className="w-1.5 h-3 bg-amber-500 animate-pulse" />
          </div>

          {/* Primary Section Heading */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-[46px] font-bold tracking-tight leading-[1.14]">
            <span>Intelligence for Every Road. </span>
            <span className="font-serif-italic font-normal text-amber-500 dark:text-amber-400">
              Every Operation.
            </span>
          </h2>

          {/* Supporting Text */}
          <p
            className={`text-base sm:text-lg font-normal leading-relaxed max-w-2xl mx-auto ${
              isDark ? 'text-zinc-400' : 'text-[#5C5346]'
            }`}
          >
            Transforming vehicle intelligence into actionable insights across transportation, infrastructure, security, and enterprise operations.
          </p>

          {/* Architectural Notice: Real-world Integrations Disclaimer */}
          <div className="pt-2 flex items-center justify-center">
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full border text-[11px] font-mono backdrop-blur-md ${
                isDark
                  ? 'bg-white/[0.03] border-white/10 text-zinc-400'
                  : 'bg-black/[0.03] border-black/10 text-[#6B6152]'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-amber-500" />
              <span>Commercial Deployment Frameworks</span>
              <span className="opacity-40">•</span>
              <span className="text-emerald-500 font-semibold">Requires System & Hardware Integration</span>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 2. CATEGORY SELECTOR PILLS                                          */}
        {/* =================================================================== */}
        <div className="flex justify-center mb-8 sm:mb-12 overflow-x-auto pb-2 scrollbar-none">
          <div
            className={`inline-flex p-1.5 rounded-2xl border backdrop-blur-md gap-1 sm:gap-2 ${
              isDark ? 'bg-white/[0.03] border-white/10' : 'bg-black/[0.03] border-black/10'
            }`}
          >
            {APPLICATIONS.map((app) => (
              <button
                key={app.id}
                onClick={() => setSelectedAppId(app.id)}
                className={`flex items-center gap-2 px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                  selectedAppId === app.id
                    ? isDark
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50 shadow-[0_0_16px_rgba(245,158,11,0.25)]'
                      : 'bg-[#B27D22]/15 text-[#8A6318] border border-[#B27D22]/40 shadow-sm'
                    : 'text-current/60 hover:text-current'
                }`}
              >
                <span className="text-[10px] opacity-60">{app.index}.</span>
                <span>{app.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* =================================================================== */}
        {/* 3. EDITORIAL SHOWCASE COMPOSITION (FLAGSHIP + WORKFLOW INSPECTOR)   */}
        {/* =================================================================== */}
        <div
          className={`relative rounded-3xl border p-6 sm:p-8 lg:p-12 transition-all duration-300 mb-12 sm:mb-16 ${
            isDark
              ? 'bg-[#0E0D0B] border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.7)]'
              : 'bg-[#FAF8F5] border-[#D0C5B3] shadow-[0_16px_45px_rgba(40,30,15,0.1)]'
          }`}
        >
          {/* Specular Edge Top Highlight */}
          <div
            className={`absolute inset-x-8 top-0 h-[1.5px] pointer-events-none ${
              isDark
                ? 'bg-gradient-to-r from-transparent via-amber-400/50 to-transparent'
                : 'bg-gradient-to-r from-transparent via-[#B27D22]/60 to-transparent'
            }`}
          />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Visual Asset with Operational HUD Overlays */}
            <div className="lg:col-span-7 space-y-4">
              <div className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-amber-500/30 bg-black shadow-2xl group">
                {/* Real Photographic Roadway Frame */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedApp.imageSrc}
                  alt={selectedApp.imageAlt}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />

                {/* Dark Surveillance Vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/40 pointer-events-none" />

                {/* Top Telemetry Header */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-[10px] font-mono">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/80 backdrop-blur-md border border-amber-500/50 text-amber-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span>{selectedApp.badge}</span>
                  </div>
                  <div className="px-2.5 py-1 rounded bg-black/70 backdrop-blur-md border border-white/10 text-zinc-300">
                    {selectedApp.index} {'//'} ENTERPRISE PROFILE
                  </div>
                </div>

                {/* Optical Caliper Reticles */}
                <div className="absolute inset-4 pointer-events-none">
                  <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-amber-400" />
                  <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-amber-400" />
                  <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-amber-400" />
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-amber-400" />
                </div>

                {/* Bottom Context Banner inside Image */}
                <div className="absolute bottom-3 left-3 right-3 p-3 rounded-xl bg-black/75 backdrop-blur-md border border-white/10 text-white flex items-center justify-between text-xs font-mono">
                  <div>
                    <div className="font-bold text-amber-400">{selectedApp.title}</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">{selectedApp.subtitle}</div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 text-[10px] text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded bg-emerald-500/10">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Edge Deployable</span>
                  </div>
                </div>
              </div>

              {/* Sub-label Disclaimer */}
              <div className="flex items-center justify-between text-[11px] font-mono text-current/50 px-1">
                <span>Deployment Framework Inspection</span>
                <span>Hardware Feeds: RTSP / ONVIF / NVR</span>
              </div>
            </div>

            {/* Right Column: Narrative, Workflows & Specs */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-600 dark:text-amber-400 mb-2">
                  <Workflow className="w-3.5 h-3.5" />
                  <span>USE CASE PROFILE // {selectedApp.index}</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">
                  {selectedApp.title}
                </h3>
                <p className={`text-xs sm:text-sm mt-2 leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#5C5346]'}`}>
                  {selectedApp.description}
                </p>
              </div>

              {/* Supported Operational Workflows */}
              <div className="space-y-2">
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-current/70">
                  Supported Operational Workflows
                </div>
                <div className="space-y-2">
                  {selectedApp.workflows.map((wf, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-start gap-2.5 text-xs font-mono ${
                        isDark ? 'bg-white/[0.02] border-white/10' : 'bg-black/[0.02] border-black/10'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span className="leading-snug text-current/90">{wf}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Integration Specifications Grid */}
              <div
                className={`p-4 rounded-2xl border grid grid-cols-2 gap-3 text-xs font-mono ${
                  isDark ? 'bg-white/[0.02] border-white/10' : 'bg-black/[0.02] border-black/10'
                }`}
              >
                {selectedApp.integrationSpecs.map((spec, sIdx) => (
                  <div key={sIdx}>
                    <span className="block text-[10px] text-current/50 uppercase">{spec.label}</span>
                    <span className="font-bold text-current mt-0.5 block truncate">{spec.value}</span>
                  </div>
                ))}
              </div>

              {/* Deployment Scope Notice */}
              <div
                className={`p-3 rounded-xl border text-[11px] font-mono flex items-start gap-2 ${
                  isDark
                    ? 'bg-amber-500/[0.04] border-amber-500/20 text-amber-300/80'
                    : 'bg-[#B27D22]/[0.06] border-[#B27D22]/20 text-[#8A6318]'
                }`}
              >
                <Compass className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" />
                <span className="leading-relaxed">{selectedApp.deploymentNotice}</span>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 4. COMPLEMENTARY THREE-PILLAR OVERVIEW TILES                         */}
        {/* =================================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {APPLICATIONS.filter((app) => app.id !== selectedAppId).map((app) => (
            <div
              key={app.id}
              onClick={() => setSelectedAppId(app.id)}
              className={`group cursor-pointer p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-between glow-card-gold ${
                isDark
                  ? 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04]'
                  : 'bg-[#FAF8F5] border-[#D0C5B3] hover:bg-white shadow-sm'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-amber-500 font-bold">{app.index}.</span>
                  <span className="text-[10px] opacity-60 uppercase">{app.badge}</span>
                </div>
                <h4 className="text-lg font-bold tracking-tight group-hover:text-amber-500 transition-colors">
                  {app.title}
                </h4>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#6B6152]'}`}>
                  {app.tagline}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-current/10 flex items-center justify-between text-xs font-mono text-current/70 group-hover:text-amber-500 transition-colors">
                <span>Inspect Deployment</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

