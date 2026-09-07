import { Link, useLocation } from "react-router-dom"
import { useAuth } from "../auth/AuthContext"

function onLightPath(pathname: string): boolean {
  return pathname.startsWith("/login") || pathname.startsWith("/register")
}

export function Nav() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const light = onLightPath(pathname)
  const landing = pathname === "/"

  return (
    <header className={`nav${light ? " nav--on-light" : ""}`}>
      <Link to="/" className="nav__logo">
        group 3
      </Link>
      <nav className="nav__menu">
        <a className="nav__link" href={landing ? "#faq" : "/#faq"}>
          FAQ
        </a>
        <a className="nav__link" href={landing ? "#contact" : "/#contact"}>
          Contact
        </a>
        {user ? (
          <>
            {user.role === "admin" ? (
              <Link className="nav__link" to="/admin/kyc">
                Admin
              </Link>
            ) : null}
            <Link className="nav__link" to="/app">
              Send
            </Link>
            <Link className="nav__link" to="/app/wallet">
              Wallet
            </Link>
            <button type="button" className="nav__button" onClick={() => void logout()}>
              Log out
            </button>
          </>
        ) : (
          <Link className="nav__button" to="/login">
            Login
          </Link>
        )}
      </nav>
    </header>
  )
}
