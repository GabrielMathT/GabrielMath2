/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { Sun, Ruler, Calculator, Info, ArrowUpRight, FileDown, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// --- Components ---

function SunVisualization({ theta, buildingWidth, buildingHeight, buildingDepth }: { theta: number, buildingWidth: number, buildingHeight: number, buildingDepth: number }) {
  const angleRad = (theta * Math.PI) / 180;
  const sunRadius = 25; // 태양을 지면과 더 가깝게(낮게) 조정
  const x = 0;
  const y = sunRadius * Math.sin(angleRad);
  const z = -sunRadius * Math.cos(angleRad);

  // 그림자 끝점 계산
  const cotTheta = theta === 90 ? 0 : 1 / Math.tan(angleRad);
  const shadowTipZ = (buildingHeight * cotTheta) + (buildingDepth / 2);

  return (
    <group>
      {/* Sun Object */}
      <group position={[x, y, z]}>
        <mesh>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
        <pointLight intensity={2} color="#fff7ed" />
      </group>
    </group>
  );
}

function BuildingModel({ width, height, depth, color = "#94a3b8", position = [0, 0, 0] }: { width: number, height: number, depth: number, color?: string, position?: [number, number, number] }) {
  return (
    <group position={[position[0], position[1] + height / 2, position[2]]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.1} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
        <lineBasicMaterial color="#334155" linewidth={1} />
      </lineSegments>
    </group>
  );
}

function Scene({ theta, buildingSize }: { theta: number, buildingSize: { w: number, h: number, d: number } }) {
  const angleRad = (theta * Math.PI) / 180;
  const sunPos = useMemo(() => {
    const r = 25; 
    return [0, r * Math.sin(angleRad), -r * Math.cos(angleRad)] as [number, number, number];
  }, [theta]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[35, 30, 35]} />
      <OrbitControls minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} makeDefault />
      
      {/* 주변광을 0에 가깝게 설정하여 그림자 내부를 어둡게 함 */}
      <ambientLight intensity={0.01} />
      <directionalLight 
        position={sunPos} 
        intensity={5} 
        castShadow 
        shadow-mapSize={[4096, 4096]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-bias={-0.0005}
      />
      
      <SunVisualization 
        theta={theta} 
        buildingWidth={buildingSize.w} 
        buildingHeight={buildingSize.h} 
        buildingDepth={buildingSize.d} 
      />
      
      {/* 메인 건물 (중앙) */}
      <BuildingModel width={buildingSize.w} height={buildingSize.h} depth={buildingSize.d} />
      
      {/* 보조 건물: 태양 경로에 맞춰 일직선(Z축)으로 배치 */}
      <BuildingModel 
        width={4} 
        height={10} 
        depth={4} 
        color="#cbd5e1" 
        position={[0, 0, -18]} // 뒤쪽
      />
      
      <BuildingModel 
        width={3} 
        height={4} 
        depth={8} 
        color="#cbd5e1" 
        position={[0, 0, 18]} // 앞쪽
      />

      {/* 바닥 (매우 넓게 확장) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.01, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      
      <gridHelper args={[200, 40, "#cbd5e1", "#f1f5f9"]} />
      
      {/* 환경광 강도를 낮춰 그림자 대비를 높임 */}
      <Environment preset="city" environmentIntensity={0.1} />
    </>
  );
}

export default function App() {
  const [theta, setTheta] = useState(45);
  const [buildingSize, setBuildingSize] = useState({ w: 4, h: 6, d: 4 });
  const [reflectionResponse, setReflectionResponse] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  
  const simContainerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Calculations
  const thetaRad = (theta * Math.PI) / 180;
  const cosTheta = Math.cos(thetaRad);
  const cotTheta = theta === 90 ? 0 : 1 / Math.tan(thetaRad);
  
  const roofArea = buildingSize.w * buildingSize.d;
  const wallProjectedArea = buildingSize.w * (buildingSize.h * cotTheta);
  const totalShadowArea = roofArea + wallProjectedArea;

  const handleDownloadPDF = async () => {
    if (!simContainerRef.current) return;
    setIsExporting(true);
    
    try {
      // 1. Capture the simulation canvas directly from the canvas element for better reliability
      const canvasElement = simContainerRef.current.querySelector('canvas');
      if (!canvasElement) throw new Error("Canvas element not found");
      const imgData = canvasElement.toDataURL('image/png');
      
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // 2. Create off-screen report element with high-quality styling for CJK support
      const reportElement = document.createElement('div');
      reportElement.style.width = '800px';
      reportElement.style.padding = '50px';
      reportElement.style.backgroundColor = 'white';
      reportElement.style.position = 'fixed';
      reportElement.style.left = '-10000px';
      reportElement.style.top = '0';
      reportElement.style.zIndex = '-9999';
      reportElement.style.color = '#1e293b';
      reportElement.style.lineHeight = '1.6';
      
      reportElement.innerHTML = `
        <div style="border-bottom: 4px solid #4f46e5; padding-bottom: 25px; margin-bottom: 40px;">
          <h1 style="font-size: 38px; font-weight: 900; color: #1e293b; margin: 0; letter-spacing: -0.02em;">그림자 정사영 탐구 활동지</h1>
          <div style="display: flex; justify-content: space-between; margin-top: 15px; color: #64748b; font-size: 14px; font-weight: 600;">
            <span>Geometry & Projections Discovery System • 활동 제작자: Gabriel Math</span>
            <span>일시: ${new Date().toLocaleString('ko-KR')}</span>
          </div>
        </div>
        
        <div style="margin-bottom: 40px; background: #f8fafc; padding: 30px; border-radius: 20px; border: 1px solid #e2e8f0;">
          <h2 style="font-size: 22px; color: #4f46e5; margin-top: 0; margin-bottom: 20px; border-left: 6px solid #4f46e5; padding-left: 15px;">1. 시뮬레이션 설정 데이터</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 16px;">
            <div>• 태양 고도(θ): <strong style="color: #1e293b;">${theta}°</strong></div>
            <div>• 건물 규모 (W x D x H): <strong style="color: #1e293b;">${buildingSize.w}m x ${buildingSize.d}m x ${buildingSize.h}m</strong></div>
            <div>• 기저 코사인값 (cos θ): <strong style="color: #1e293b;">${cosTheta.toFixed(4)}</strong></div>
            <div>• 총 그림자 면적 (S'): <strong style="color: #4f46e5; font-size: 18px;">${totalShadowArea.toFixed(2)}m²</strong></div>
          </div>
        </div>

        <div style="margin-bottom: 40px;">
          <h2 style="font-size: 22px; color: #4f46e5; margin-bottom: 20px; border-left: 6px solid #4f46e5; padding-left: 15px;">2. 탐구 결과 및 느낀점</h2>
          <div style="margin-bottom: 25px;">
            <p style="font-weight: 800; color: #334155; font-size: 16px; margin-bottom: 12px; background: #f1f5f9; padding: 10px 15px; border-radius: 8px;">Q. 그림자 정사영 탐구 도구를 통해서 느낀점을 작성하시오.</p>
            <div style="padding: 25px; background: #fdfdfd; border-radius: 16px; min-height: 150px; font-size: 15px; line-height: 1.8; border: 1px solid #cbd5e1; color: #475569; white-space: pre-wrap;">${reflectionResponse || "입력된 내용이 없습니다."}</div>
          </div>
        </div>

        <div style="margin-top: 50px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px; font-weight: 600; letter-spacing: 0.1em;">
          MATHEMATICS & 3D ENGINEERING EDUCATION SYSTEM
        </div>
      `;
      
      document.body.appendChild(reportElement);
      
      // Wait a small bit for any styles to apply
      await new Promise(r => setTimeout(r, 100));
      
      const reportCanvas = await html2canvas(reportElement, { 
        scale: 2,
        logging: false,
        backgroundColor: '#ffffff'
      });
      document.body.removeChild(reportElement);
      
      const reportImg = reportCanvas.toDataURL('image/png');
      
      // Calculate dimensions
      const reportWidth = pageWidth - 30; // 15mm margins
      const reportHeight = (reportCanvas.height * reportWidth) / reportCanvas.width;
      
      // Add report content
      doc.addImage(reportImg, 'PNG', 15, 15, reportWidth, reportHeight);
      
      // Add Simulation image
      const simWidth = pageWidth - 30;
      const simHeight = (canvasElement.height * simWidth) / canvasElement.width;
      
      // Position logic: if it doesn't fit on page 1, add to page 2
      if (15 + reportHeight + 10 + simHeight + 15 > doc.internal.pageSize.getHeight()) {
        doc.addPage();
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text('시뮬레이션 캡쳐 결과', 15, 12);
        doc.addImage(imgData, 'PNG', 15, 15, simWidth, simHeight);
      } else {
        doc.addImage(imgData, 'PNG', 15, 15 + reportHeight + 10, simWidth, simHeight);
      }
      
      doc.save(`탐구활동지_${theta}도_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error("PDF generation failed", error);
      alert("PDF 생성 중 오류가 발생했습니다. 브라우저 설정을 확인해 주세요.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100" ref={scrollRef}>
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-amber-100 p-2 rounded-xl">
              <Sun className="w-6 h-6 text-amber-600 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-slate-800">그림자 정사영 탐구 도구</h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mathematics & 3D Engineering</span>
                <span className="w-1 h-1 bg-slate-200 rounded-full" />
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">활동 제작자: Gabriel Math</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 rounded-xl text-sm font-black text-white flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-100"
            >
              {isExporting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <FileDown className="w-5 h-5" />
              )}
              {isExporting ? 'PDF 생성 중...' : '탐구 활동지 PDF 다운로드'}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 outline-none">
        
        {/* Simulation Section */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          <motion.div 
            layout
            ref={simContainerRef}
            className="aspect-[16/9] md:aspect-auto md:h-[600px] bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xl shadow-slate-200/50 relative group"
          >
            {/* Visual Indicators on Canvas */}
            <div className="absolute top-6 left-6 z-10 flex flex-col gap-3 pointer-events-none">
              <div className="bg-white/95 backdrop-blur border border-slate-200 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-3">
                <div className="p-1.5 bg-amber-50 rounded-lg"><Sun className="w-4 h-4 text-amber-500" /></div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">고도 (&theta;)</div>
                  <div className="text-xl font-black text-slate-800">{theta}&deg;</div>
                </div>
              </div>
              <div className="bg-white/95 backdrop-blur border border-slate-200 px-4 py-2 rounded-2xl shadow-xl flex items-center gap-3">
                <div className="p-1.5 bg-indigo-50 rounded-lg"><Calculator className="w-4 h-4 text-indigo-500" /></div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">코사인 임계값</div>
                  <div className="text-xl font-black text-slate-800">{cosTheta.toFixed(4)}</div>
                </div>
              </div>
            </div>

            <Canvas 
              shadows 
              className="bg-slate-50" 
              gl={{ 
                antialias: true,
                preserveDrawingBuffer: true // PDF 캡처를 위해 캔버스 버퍼 보존 필수
              }}
            >
              <Scene theta={theta} buildingSize={buildingSize} />
            </Canvas>

            {/* Bottom Floating Stats */}
            <AnimatePresence mode="wait">
              <motion.div 
                key={`${theta}-${buildingSize.h}`}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-4 pointer-events-none"
              >
                <div className="bg-slate-900/95 backdrop-blur border border-slate-800 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-4 text-white">
                  <div className="text-center min-w-20">
                    <div className="text-[9px] font-bold text-slate-400 uppercase mb-1 whitespace-nowrap">옥상 정사영 (S_top)</div>
                    <div className="text-base font-black">{roofArea.toFixed(2)}m&sup2;</div>
                  </div>
                  <div className="w-[1px] h-8 bg-slate-700" />
                  <div className="text-center min-w-20">
                    <div className="text-[9px] font-bold text-slate-400 uppercase mb-1 whitespace-nowrap">벽면 정사영 (S_side)</div>
                    <div className="text-base font-black">{wallProjectedArea.toFixed(2)}m&sup2;</div>
                  </div>
                  <div className="w-[1px] h-8 bg-slate-700" />
                  <div className="text-center min-w-20">
                    <div className="text-[9px] font-bold text-indigo-400 uppercase mb-1 whitespace-nowrap">총 그림자 넓이 (S')</div>
                    <div className="text-xl font-black text-indigo-300">{(totalShadowArea).toFixed(2)}m&sup2;</div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Controls Panel */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-8 select-none">
            <div className="flex flex-col gap-4 bg-slate-50/50 p-6 rounded-2xl border border-slate-100 transition-colors hover:bg-slate-50">
              <div className="flex items-center justify-between font-bold text-slate-800 text-sm">
                <span className="flex items-center gap-2"><Sun className="w-5 h-5 text-amber-500" /> 태양 고도 조절 (&theta;)</span>
                <span className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full tabular-nums font-black">{theta}&deg;</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="90" 
                step="1" 
                value={theta} 
                onChange={(e) => setTheta(parseFloat(e.target.value))}
                className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-600 transition-all hover:bg-slate-300"
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
                <span>일출/일몰 (Low)</span>
                <span>남중 고도 (90&deg;)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <ControlSlider 
                label="건물 높이 (H)" 
                value={buildingSize.h} 
                min={1} max={15} 
                onChange={(v) => setBuildingSize(s => ({...s, h: v}))}
                icon={<ArrowUpRight className="w-3.5 h-3.5 text-blue-500" />}
              />
              <ControlSlider 
                label="건물 가로 (W)" 
                value={buildingSize.w} 
                min={1} max={10} 
                onChange={(v) => setBuildingSize(s => ({...s, w: v}))}
              />
              <ControlSlider 
                label="건물 깊이 (D)" 
                value={buildingSize.d} 
                min={1} max={10} 
                onChange={(v) => setBuildingSize(s => ({...s, d: v}))}
              />
            </div>
          </div>
        </section>

        {/* Activity Section */}
        <aside className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-emerald-800">
              <div className="bg-emerald-100 p-2 rounded-xl">
                <Info className="w-5 h-5" />
              </div>
              <h3 className="font-black text-base uppercase tracking-tight leading-none">탐구 포인트</h3>
            </div>
            <p className="text-sm text-emerald-800/80 font-medium leading-relaxed">
              중점적으로 고도가 <span className="font-bold text-emerald-900 underline decoration-emerald-200 underline-offset-4">90&deg;</span>에 도달할 때의 코사인 값의 변화를 확인하고, 
              어느 면이 지면에 그림자를 남기는지 관찰해 보세요.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Ruler className="w-4 h-4 text-indigo-600" /> 탐구 기록지
              </h2>
            </div>
            
            <div className="p-6 space-y-8" id="response-area">
              <ResponseField 
                number={1} 
                label="그림자 정사영 탐구 도구를 통해서 느낀점을 작성하시오."
                value={reflectionResponse}
                onChange={setReflectionResponse}
                placeholder="도구를 조작하며 새롭게 알게 된 사실이나 느낀 점을 자유롭게 적어보세요..."
              />

              <div className="pt-4">
                <button 
                  onClick={handleDownloadPDF}
                  disabled={isExporting}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl active:scale-[0.98]"
                >
                  {isExporting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FileDown className="w-5 h-5 text-indigo-400" />}
                  활동지 PDF로 저장하기
                </button>
                <p className="text-center text-[10px] text-slate-400 font-bold mt-4 uppercase tracking-tighter">
                  작성하신 내용과 시뮬레이션 결과가 PDF 활동지에 포함됩니다.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-12 text-center border-t border-slate-100 mt-12 bg-white/30">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-2">Geometry & Projections Discovery System • v.1.2</p>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">활동 제작자: Gabriel Math</p>
      </footer>
    </div>
  );
}

function ControlSlider({ label, value, min, max, onChange, icon }: { 
  label: string, 
  value: number, 
  min: number, 
  max: number, 
  onChange: (v: number) => void,
  icon?: React.ReactNode
}) {
  return (
    <div className="space-y-4 bg-slate-50/30 p-4 rounded-2xl border border-slate-100 group transition-all hover:bg-white hover:shadow-md">
      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
        <span className="uppercase flex items-center gap-1.5 leading-none transition-colors group-hover:text-slate-600">
          {icon} {label}
        </span>
        <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-black tabular-nums">{value}m</span>
      </div>
      <input 
        type="range" 
        min={min} max={max} step={0.1} 
        value={value} 
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer accent-indigo-500 transition-all hover:bg-slate-300"
      />
    </div>
  );
}

function ResponseField({ number, label, value, onChange, placeholder }: { 
  number: number, 
  label: string, 
  value: string, 
  onChange: (v: string) => void,
  placeholder: string
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <span className="flex-none bg-slate-900 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shadow-lg shadow-slate-200">
          {number}
        </span>
        <label className="text-[13px] font-bold text-slate-700 leading-snug pt-0.5">
          {label}
        </label>
      </div>
      <textarea 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-36 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none resize-none placeholder:text-slate-300 leading-relaxed font-medium shadow-inner"
      />
    </div>
  );
}
