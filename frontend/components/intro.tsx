"use client";

import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";

export function Intro() {
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    if (sessionStorage.getItem("flumenx_intro_seen")) return;
    setVisible(true);
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power4.out" }, onComplete: () => { sessionStorage.setItem("flumenx_intro_seen", "1"); setVisible(false); } });
      tl.set(".trailer-frame", { opacity: 0 })
        .fromTo(".cinema-line", { scaleX: 0 }, { scaleX: 1, duration: .55 })
        .to(".trailer-frame.one", { opacity: 1, duration: .12 })
        .from(".trailer-frame.one span", { y: 55, opacity: 0, stagger: .09, duration: .55 })
        .to(".trailer-frame.one", { opacity: 0, scale: 1.08, duration: .25 }, "+=.4")
        .to(".trailer-frame.two", { opacity: 1, duration: .08 })
        .from(".trailer-frame.two strong", { letterSpacing: ".65em", opacity: 0, duration: .6 })
        .to(".trailer-frame.two", { opacity: 0, duration: .18 }, "+=.35")
        .to(".trailer-brand", { opacity: 1, duration: .08 })
        .from(".trailer-letter", { yPercent: 110, rotateX: -85, opacity: 0, stagger: .055, duration: .7 })
        .from(".trailer-tag", { y: 20, opacity: 0, duration: .4 }, "-=.2")
        .to(".trailer-sweep", { xPercent: 220, duration: .85 }, "-=.75")
        .to(".trailer-brand", { scale: 13, opacity: 0, duration: .9, ease: "expo.in" }, "+=.3")
        .to(root.current, { opacity: 0, duration: .3 }, "-=.1");
    }, root);
    return () => ctx.revert();
  }, []);

  if (!visible) return null;
  return (
    <div className="intro trailer-intro" ref={root}>
      <div className="trailer-noise" />
      <div className="cinema-line top" /><div className="cinema-line bottom" />
      <div className="trailer-frame one"><span>PEOPLE.</span><span>WORK.</span><span>IN MOTION.</span></div>
      <div className="trailer-frame two"><small>THE FUTURE OF WORK</small><strong>FLOWS HERE</strong></div>
      <div className="trailer-brand"><div className="trailer-word">{"FLUMENX".split("").map((letter, i) => <span className="trailer-letter" key={i}>{letter}</span>)}</div><div className="trailer-tag">Employee intelligence · Reimagined</div></div>
      <div className="trailer-sweep" />
      <div className="trailer-counter">00 : 04</div>
    </div>
  );
}
