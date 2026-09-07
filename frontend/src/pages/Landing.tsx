import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useLocation } from "react-router-dom"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { Nav } from "../components/Nav"
import { CreateCoins } from "../fx/CreateCoins"
import { FooterScene } from "../fx/FooterScene"
import { HeroScene } from "../fx/HeroScene"
import { isMobileLayout, prefersReducedMotion } from "../fx/motion"
import { RequestsScene } from "../fx/RequestsScene"
import { SAMPLE_TRACKING_REF, ScanCursor, TrackingQr } from "../fx/ScanCursor"

gsap.registerPlugin(ScrollTrigger)

const HERO_WORDS = ["Send", "rand,", "settle", "on", "XRPL,", "fast!"] as const
const HERO_STAT = ["Quotes", "lock", "fees", "for"] as const
const CREATE_HEADS = ["Create", "a remittance", "quote"] as const
const CREATE_LINE_1 = ["Make", "a", "locked", "fee", "quote", "in"] as const
const CREATE_LINE_2 = ["Itemised", "FX", "margin.", "Cancel", "before", "cash-in."] as const
const FEATURES = [
  {
    title: "Itemised fees",
    body: "fixed + % + FX margin shown before send",
  },
  {
    title: "15-minute quote",
    body: "cancel so abandoned drafts do not eat limits",
  },
  {
    title: "Beneficiary link",
    body: "match by mobile or email",
  },
  {
    title: "Track & Trace",
    body: "MG + 10 digits, status through settlement",
  },
] as const
const CONTACT_TILES = [
  "Annita Ngoma",
  "Karabo Tigedi",
  "Kerry-Lynn Whyte",
  "Liltha Mzamo",
  "Nikola Milosavljevic",
  "UCT ECO5040W",
  "XRPL Testnet",
] as const
const CONTACT_FACTS = [
  {
    label: "Course",
    body: "ECO5040W · Financial Software Engineering · University of Cape Town",
  },
  {
    label: "Prototype",
    body: "XRPL Remit · simulated ZAR rails · UCTUSD on Testnet · no live customer funds",
  },
  {
    label: "Campus",
    body: "School of Economics · Rondebosch, Cape Town",
  },
  {
    label: "Source",
    body: "github.com/Karabo22Tigedi/FSE-Project",
    href: "https://github.com/Karabo22Tigedi/FSE-Project",
  },
] as const

function splitWords(words: readonly string[]) {
  return words.map((word) => (
    <div key={word} className="create__text">
      {word}
    </div>
  ))
}

export function Landing() {
  const rootRef = useRef<HTMLDivElement>(null)
  const preloaderRef = useRef<HTMLDivElement>(null)
  const scanRef = useRef<HTMLElement>(null)
  const { hash } = useLocation()
  const [heroReady, setHeroReady] = useState(false)
  const [fontsReady, setFontsReady] = useState(false)
  const onHeroReady = useCallback(() => setHeroReady(true), [])

  useEffect(() => {
    document.documentElement.classList.add("landing-html")
    document.body.classList.add("landing")
    return () => {
      document.documentElement.classList.remove("landing-html")
      document.body.classList.remove("landing", "landing-on-light")
    }
  }, [])

  useEffect(() => {
    let alive = true
    const done = () => {
      if (alive) setFontsReady(true)
    }
    if (document.fonts?.ready) void document.fonts.ready.then(done)
    else done()
    const timer = window.setTimeout(done, 2500)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => setHeroReady(true), 5000)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!fontsReady || !heroReady) return
    const root = rootRef.current
    const preloader = preloaderRef.current
    if (!root) return

    const reduced = prefersReducedMotion()
    const mobile = isMobileLayout()

    const scrollToHash = () => {
      const id = window.location.hash.replace("#", "")
      if (!id) return
      document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" })
    }

    const ctx = gsap.context(() => {
      const playHero = () => {
        if (reduced) {
          gsap.set(".hero__heading, .hero__text", { opacity: 1, y: 0 })
          gsap.set(".hero__underline", { scaleX: 1 })
          gsap.set(".hero__videos-wrapper", { scale: 1 })
          return
        }
        gsap.set(".hero__heading", { y: 28 })
        gsap.fromTo(
          ".hero__videos-wrapper",
          { scale: 0.5 },
          { scale: 1, duration: 1.05, ease: "power2.out" },
        )
        const tl = gsap.timeline()
        tl.to(".hero__heading", {
          opacity: 1,
          y: 0,
          duration: 0.55,
          stagger: 0.11,
          ease: "power2.out",
        })
        tl.to(
          ".hero__text",
          { opacity: 1, duration: 0.32, stagger: 0.045, ease: "power1.out" },
          "-=0.12",
        )
        tl.to(".hero__underline", { scaleX: 1, duration: 0.42, ease: "power2.out" }, "-=0.08")
      }

      if (reduced) {
        if (preloader) {
          gsap.set(preloader, { opacity: 0, display: "none" })
        }
        playHero()
        scrollToHash()
      } else {
        gsap.to(preloader, {
          opacity: 0,
          duration: 0.45,
          ease: "power2.out",
          onComplete: () => {
            if (preloader) preloader.style.display = "none"
            playHero()
            scrollToHash()
            ScrollTrigger.refresh()
          },
        })
      }

      if (!reduced && !mobile) {
        gsap.to(".create__heading", {
          opacity: 1,
          scale: 1,
          duration: 0.78,
          stagger: 0.12,
          ease: "back.out(1.35)",
          scrollTrigger: { trigger: ".create", start: "top 72%" },
        })
        gsap.to([".create__coin1", ".create__coin2", ".create__coin3"], {
          scale: 1,
          duration: 0.7,
          stagger: 0.14,
          ease: "back.out(1.55)",
          scrollTrigger: { trigger: ".create", start: "top 68%" },
        })
        gsap.to(".create__coin1-wrapper", {
          y: -80,
          ease: "none",
          scrollTrigger: { trigger: ".create", start: "top bottom", end: "bottom top", scrub: 1.1 },
        })
        gsap.to(".create__coin2-wrapper", {
          y: 55,
          ease: "none",
          scrollTrigger: { trigger: ".create", start: "top bottom", end: "bottom top", scrub: 1.4 },
        })
        gsap.to(".create__coin3-wrapper", {
          y: -40,
          ease: "none",
          scrollTrigger: { trigger: ".create", start: "top bottom", end: "bottom top", scrub: 0.9 },
        })
      } else {
        gsap.set(".create__heading", { opacity: 1, scale: 1 })
        gsap.set([".create__coin1", ".create__coin2", ".create__coin3"], { scale: 1 })
      }

      gsap.from(".create__text", {
        opacity: reduced ? 1 : 0,
        y: reduced ? 0 : 12,
        duration: 0.4,
        stagger: reduced ? 0 : 0.03,
        scrollTrigger: { trigger: ".create__text-wrapper1", start: "top 80%" },
      })

      gsap.from(".create__feature", {
        opacity: reduced ? 1 : 0,
        y: reduced ? 0 : 24,
        duration: 0.55,
        stagger: reduced ? 0 : 0.12,
        scrollTrigger: { trigger: ".create__features-wrapper", start: "top 82%" },
      })

      gsap.from(".requests__wrapper", {
        opacity: reduced ? 1 : 0,
        y: reduced ? 0 : 28,
        duration: 0.7,
        scrollTrigger: { trigger: ".requests", start: "top 70%" },
      })

      gsap.from(".scan__heading, .scan__text", {
        opacity: reduced ? 1 : 0,
        y: reduced ? 0 : 20,
        duration: 0.6,
        stagger: reduced ? 0 : 0.08,
        scrollTrigger: { trigger: ".scan", start: "top 72%" },
      })

      if (!reduced) {
        const track = root.querySelector(".payment__track")
        if (track) {
          gsap.to(track, {
            xPercent: -50,
            duration: 26,
            ease: "none",
            repeat: -1,
          })
        }
      }

      ScrollTrigger.create({
        trigger: ".payment",
        start: "top 88px",
        endTrigger: ".footer",
        end: "top 88px",
        toggleClass: { targets: document.body, className: "landing-on-light" },
      })
    }, root)

    return () => ctx.revert()
  }, [fontsReady, heroReady])

  useEffect(() => {
    if (!fontsReady || !heroReady) return
    const id = hash.replace("#", "")
    if (!id) return
    const reduced = prefersReducedMotion()
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" })
  }, [fontsReady, hash, heroReady])

  const contactTiles = [...CONTACT_TILES, ...CONTACT_TILES, ...CONTACT_TILES]

  return (
    <div className="landing-page" ref={rootRef}>
      <Nav />
      <div className="preloader" ref={preloaderRef}>
        <div className="preloader__text">Loading...</div>
      </div>

      <section className="hero">
        <HeroScene onReady={onHeroReady} />
        <div className="hero__wrapper">
          <div className="hero__heading-wrapper">
            {HERO_WORDS.map((word) => (
              <h2 key={word} className="hero__heading">
                {word}
              </h2>
            ))}
          </div>
          <div className="hero__text-wrapper">
            {HERO_STAT.map((word) => (
              <div key={word} className="hero__text">
                {word}
              </div>
            ))}
            <div className="hero__text hero__text--underline">
              15 minutes.
              <span className="hero__underline" />
            </div>
          </div>
          <Link to="/register" className="nav__button hero__cta">
            Register
          </Link>
        </div>
        <svg className="hero__arrow hero__arrow--hiden-mobile" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 4v14M6 14l6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </section>

      <section className="create" id="faq">
        <CreateCoins />
        <div className="create__intro-wrapper">
          <div className="create__heading-wrapper">
            {CREATE_HEADS.map((line) => (
              <h1 key={line} className="create__heading">
                {line}
              </h1>
            ))}
          </div>
          <div className="create__text-wrapper1">
            {splitWords(CREATE_LINE_1)}
            <div className="create__text create__text--blue">15</div>
            <div className="create__text create__text--blue">minutes.</div>
          </div>
          <div className="create__text-wrapper2">{splitWords(CREATE_LINE_2)}</div>
        </div>
        <div className="create__features-wrapper">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="create__feature">
              <h4 className="create__feature-heading">{feature.title}</h4>
              <div className="create__feature-text">{feature.body}</div>
            </div>
          ))}
        </div>
        <p className="create__faq">
          Quotes lock for 15 minutes. Cancel a draft so it does not consume daily or monthly ZAR
          limits. Track & Trace uses MG plus ten digits through Testnet settlement.
        </p>
      </section>

      <section className="requests">
        <div className="requests__video-wrapper">
          <RequestsScene />
        </div>
        <div className="requests__wrapper">
          <h3 className="requests__heading">
            Easily
            <br />
            send to a beneficiary
          </h3>
          <div className="requests__text">... or share the tracking ref</div>
        </div>
      </section>

      <section className="scan" ref={scanRef}>
        <div className="scan__cursor-appears" />
        <div className="scan__text-wrapper">
          <h1 className="scan__heading">
            Scan
            <br />
            &amp; Go
          </h1>
          <div className="scan__text">
            Turn the tracking ref into a QR code. Scan {SAMPLE_TRACKING_REF} on a phone to follow
            settlement.
          </div>
        </div>
        <div className="scan__code-wrapper">
          <div className="scan__qrcode-wrapper scan__static-qr">
            <TrackingQr className="scan__qrcode" />
          </div>
        </div>
        <ScanCursor sectionRef={scanRef} />
      </section>

      <section className="payment" id="contact">
        <div className="payment__wrapper">
          <h1 className="payment__heading">Contact</h1>
          <div className="payment__text">
            UCT ECO5040W Group 3. Academic remittance prototype — no customer inbox, no Visa, no
            live funds.
          </div>
          <div className="contact-facts">
            {CONTACT_FACTS.map((fact) => (
              <article key={fact.label} className="contact-facts__item">
                <h2>{fact.label}</h2>
                {"href" in fact ? (
                  <a href={fact.href} target="_blank" rel="noreferrer">
                    {fact.body}
                  </a>
                ) : (
                  <p>{fact.body}</p>
                )}
              </article>
            ))}
          </div>
        </div>
        <div className="payment__methods">
          <div className="payment__track">
            {contactTiles.map((label, index) => (
              <div key={`${label}-${index}`} className="payment__tile">
                <span className="payment__tile-label">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer">
        <FooterScene />
        <div className="footer__wrapper">
          <div className="footer__heading-wrapper">
            <h2 className="footer__heading">
              Start for
              <br />
              free today
            </h2>
            <Link to="/register" className="footer__cta">
              Register
            </Link>
          </div>
          <div className="footer__bottom">
            <div className="footer__powered">UCT ECO5040W · no real customer funds · Testnet only</div>
            <div className="footer__copyright">Group 3 · XRPL Remit</div>
          </div>
        </div>
      </footer>
    </div>
  )
}
