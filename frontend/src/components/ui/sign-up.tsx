'use client';

import { cn } from "@/lib/utils";
import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useCallback,
  createContext,
  Children,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cva, type VariantProps } from "class-variance-authority";
import {
  ArrowRight,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  X,
  AlertCircle,
  PartyPopper,
  Loader,
  Shield,
  Sun,
  Moon,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { AnimatePresence, motion, useInView, Variants, Transition } from "framer-motion";
import type { GlobalOptions as ConfettiGlobalOptions, CreateTypes as ConfettiInstance, Options as ConfettiOptions } from "canvas-confetti";
import confetti from "canvas-confetti";
import { AuthService } from "@/lib/auth";

// --- CONFETTI LOGIC ---
type Api = { fire: (options?: ConfettiOptions) => void };
export type ConfettiRef = Api | null;
const ConfettiContext = createContext<Api>({} as Api);

const Confetti = forwardRef<
  ConfettiRef,
  React.ComponentPropsWithRef<"canvas"> & {
    options?: ConfettiOptions;
    globalOptions?: ConfettiGlobalOptions;
    manualstart?: boolean;
  }
>((props, ref) => {
  const { options, globalOptions = { resize: true, useWorker: true }, manualstart = false, ...rest } = props;
  const instanceRef = useRef<ConfettiInstance | null>(null);
  const canvasRef = useCallback(
    (node: HTMLCanvasElement) => {
      if (node !== null) {
        if (instanceRef.current) return;
        instanceRef.current = confetti.create(node, { ...globalOptions, resize: true });
      } else {
        if (instanceRef.current) {
          instanceRef.current.reset();
          instanceRef.current = null;
        }
      }
    },
    [globalOptions]
  );
  const fire = useCallback((opts = {}) => instanceRef.current?.({ ...options, ...opts }), [options]);
  const api = useMemo(() => ({ fire }), [fire]);
  useImperativeHandle(ref, () => api, [api]);
  useEffect(() => {
    if (!manualstart) fire();
  }, [manualstart, fire]);
  return <canvas ref={canvasRef} {...rest} />;
});
Confetti.displayName = "Confetti";

// --- TEXT LOOP ANIMATION COMPONENT ---
type TextLoopProps = {
  children: React.ReactNode[];
  className?: string;
  interval?: number;
  transition?: Transition;
  variants?: Variants;
  onIndexChange?: (index: number) => void;
  stopOnEnd?: boolean;
};

export function TextLoop({
  children,
  className,
  interval = 1.4,
  transition = { duration: 0.3 },
  variants,
  onIndexChange,
  stopOnEnd = false,
}: TextLoopProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const items = Children.toArray(children);
  useEffect(() => {
    const intervalMs = interval * 1000;
    const timer = setInterval(() => {
      setCurrentIndex((current) => {
        if (stopOnEnd && current === items.length - 1) {
          clearInterval(timer);
          return current;
        }
        const next = (current + 1) % items.length;
        onIndexChange?.(next);
        return next;
      });
    }, intervalMs);
    return () => clearInterval(timer);
  }, [items.length, interval, onIndexChange, stopOnEnd]);
  const motionVariants: Variants = {
    initial: { y: 20, opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: -20, opacity: 0 },
  };
  return (
    <div className={cn("relative inline-block whitespace-nowrap", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={currentIndex}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          variants={variants || motionVariants}
        >
          {items[currentIndex]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// --- BLUR FADE COMPONENT ---
interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  variant?: { hidden: { y: number }; visible: { y: number } };
  duration?: number;
  delay?: number;
  yOffset?: number;
  inView?: boolean;
  inViewMargin?: string;
  blur?: string;
}

function BlurFade({
  children,
  className,
  variant,
  duration = 0.4,
  delay = 0,
  yOffset = 6,
  inView = true,
  inViewMargin = "-50px",
  blur = "6px",
}: BlurFadeProps) {
  const ref = useRef(null);
  const inViewResult = useInView(ref, { once: true, margin: inViewMargin as any });
  const isInView = !inView || inViewResult;
  const defaultVariants: Variants = {
    hidden: { y: yOffset, opacity: 0, filter: `blur(${blur})` },
    visible: { y: -yOffset, opacity: 1, filter: `blur(0px)` },
  };
  const combinedVariants = variant || defaultVariants;
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      exit="hidden"
      variants={combinedVariants}
      transition={{ delay: 0.04 + delay, duration, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// --- BUILT-IN GLASS BUTTON COMPONENT ---
const glassButtonVariants = cva(
  "relative isolate all-unset cursor-pointer rounded-full transition-all outline-none",
  {
    variants: {
      size: {
        default: "text-base font-medium",
        sm: "text-sm font-medium",
        lg: "text-lg font-medium",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { size: "default" },
  }
);
const glassButtonTextVariants = cva(
  "glass-button-text relative block select-none tracking-tighter",
  {
    variants: {
      size: {
        default: "px-6 py-3.5",
        sm: "px-4 py-2",
        lg: "px-8 py-4",
        icon: "flex h-10 w-10 items-center justify-center",
      },
    },
    defaultVariants: { size: "default" },
  }
);

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  contentClassName?: string;
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, children, size, contentClassName, onClick, type = "button", ...props }, ref) => {
    const handleWrapperClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const button = e.currentTarget.querySelector("button");
      if (button && e.target !== button) button.click();
    };
    return (
      <div className={cn("glass-button-wrap cursor-pointer rounded-full relative", className)} onClick={handleWrapperClick}>
        <button
          type={type}
          className={cn("glass-button relative z-10", glassButtonVariants({ size }))}
          ref={ref}
          onClick={onClick}
          {...props}
        >
          <span className={cn(glassButtonTextVariants({ size }), contentClassName)}>{children}</span>
        </button>
        <div className="glass-button-shadow rounded-full pointer-events-none"></div>
      </div>
    );
  }
);
GlassButton.displayName = "GlassButton";

// --- CHILD COMPONENTS ---
const GoogleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-5 h-5 flex-shrink-0">
    <g fillRule="evenodd" fill="none">
      <g fillRule="nonzero" transform="translate(3, 2)">
        <path fill="#4285F4" d="M57.8123233,30.1515267 C57.8123233,27.7263183 57.6155321,25.9565533 57.1896408,24.1212666 L29.4960833,24.1212666 L29.4960833,35.0674653 L45.7515771,35.0674653 C45.4239683,37.7877475 43.6542033,41.8844383 39.7213169,44.6372555 L39.6661883,45.0037254 L48.4223791,51.7870338 L49.0290201,51.8475849 C54.6004021,46.7020943 57.8123233,39.1313952 57.8123233,30.1515267" />
        <path fill="#34A853" d="M29.4960833,58.9921667 C37.4599129,58.9921667 44.1456164,56.3701671 49.0290201,51.8475849 L39.7213169,44.6372555 C37.2305867,46.3742596 33.887622,47.5868638 29.4960833,47.5868638 C21.6960582,47.5868638 15.0758763,42.4415991 12.7159637,35.3297782 L12.3700541,35.3591501 L3.26524241,42.4054492 L3.14617358,42.736447 C7.9965904,52.3717589 17.959737,58.9921667 29.4960833,58.9921667" />
        <path fill="#FBBC05" d="M12.7159637,35.3297782 C12.0932812,33.4944915 11.7329116,31.5279353 11.7329116,29.4960833 C11.7329116,27.4640054 12.0932812,25.4976752 12.6832029,23.6623884 L12.6667095,23.2715173 L3.44779955,16.1120237 L3.14617358,16.2554937 C1.14708246,20.2539019 0,24.7439491 0,29.4960833 C0,34.2482175 1.14708246,38.7380388 3.14617358,42.736447 L12.7159637,35.3297782" />
        <path fill="#EB4335" d="M29.4960833,11.4050769 C35.0347044,11.4050769 38.7707997,13.7975244 40.9011602,15.7968415 L49.2255853,7.66898166 C44.1130815,2.91684746 37.4599129,0 29.4960833,0 C17.959737,0 7.9965904,6.62018183 3.14617358,16.2554937 L12.6832029,23.6623884 C15.0758763,16.5505675 21.6960582,11.4050769 29.4960833,11.4050769" />
      </g>
    </g>
  </svg>
);

const GitHubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" className="w-5 h-5 flex-shrink-0">
    <path
      fill="currentColor"
      d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
    />
  </svg>
);

const modalSteps = [
  { message: "Authenticating operator...", icon: <Loader className="w-12 h-12 text-emerald-500 animate-spin" /> },
  { message: "Verifying security credentials...", icon: <Loader className="w-12 h-12 text-emerald-500 animate-spin" /> },
  { message: "Synchronizing telemetry pipelines...", icon: <Loader className="w-12 h-12 text-emerald-500 animate-spin" /> },
  { message: "Welcome Aboard!", icon: <PartyPopper className="w-12 h-12 text-emerald-500" /> },
];
const TEXT_LOOP_INTERVAL = 1.3;

// --- MAIN COMPONENT ---
interface AuthComponentProps {
  logo?: React.ReactNode;
  brandName?: string;
  theme?: 'dark' | 'beige';
  onToggleTheme?: () => void;
  onSuccessRedirect?: string;
  defaultMode?: 'signin' | 'signup' | string;
}

export const AuthComponent = ({
  brandName = "VisionPlate AI",
  theme = 'dark',
  onToggleTheme,
  onSuccessRedirect = "/app/dashboard",
  defaultMode = 'signin',
}: AuthComponentProps) => {
  const router = useRouter();
  const isDark = theme === 'dark';

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authStep, setAuthStep] = useState<"email" | "password" | "confirmPassword">("email");
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>(
    defaultMode === 'signup' ? 'signup' : 'signin'
  );
  const [oauthData, setOauthData] = useState<{
    provider: 'google' | 'github';
    provider_user_id: string;
    email: string;
    name: string;
    avatar_url?: string;
  } | null>(null);

  // Modal feedback state
  const [modalStatus, setModalStatus] = useState<'closed' | 'loading' | 'success' | 'error'>('closed');
  const [modalErrorMessage, setModalErrorMessage] = useState('');
  const [modalErrorCode, setModalErrorCode] = useState('');

  // Detect OAuth setup query parameter or OAuth errors
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const isOAuthSetup = params.get('oauth_setup') === 'true';
      if (isOAuthSetup) {
        const oEmail = params.get('email') || '';
        const oName = params.get('name') || '';
        const oProvider = (params.get('provider') || 'google') as 'google' | 'github';
        const oUserId = params.get('provider_user_id') || '';
        const oAvatar = params.get('avatar_url') || '';

        setOauthData({
          provider: oProvider,
          provider_user_id: oUserId,
          email: oEmail,
          name: oName,
          avatar_url: oAvatar,
        });
        setEmail(oEmail);
        setUsername(oEmail.split('@')[0].replace(/\./g, '_'));
        setAuthMode('signup');
        setAuthStep('password');
        window.history.replaceState({}, '', window.location.pathname);
      }

      const urlError = params.get('error') || params.get('error_description');
      if (urlError) {
        const decoded = decodeURIComponent(urlError);
        let friendly = decoded;
        if (decoded === 'Unauthorized' || decoded === 'Could not validate credentials') {
          friendly = 'Social authorization failed or expired. Please try again or sign in with your email/password.';
        }
        setModalErrorMessage(friendly);
        setModalStatus('error');
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const confettiRef = useRef<ConfettiRef>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const confirmPasswordInputRef = useRef<HTMLInputElement>(null);

  const isEmailValid = useMemo(() => {
    if (authMode === 'signin') {
      return email.trim().length >= 3;
    }
    return /\S+@\S+\.\S+/.test(email);
  }, [email, authMode]);
  const isPasswordValid = useMemo(() => password.length >= 6, [password]);
  const isConfirmPasswordValid = useMemo(() => confirmPassword.length >= 6 && confirmPassword === password, [confirmPassword, password]);

  // Confetti fireworks
  const fireSideCanons = () => {
    const fire = confettiRef.current?.fire;
    if (fire) {
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };
      const particleCount = 45;
      fire({ ...defaults, particleCount, origin: { x: 0, y: 1 }, angle: 60 });
      fire({ ...defaults, particleCount, origin: { x: 1, y: 1 }, angle: 120 });
    }
  };

  // Step progression check: advances steps based on active auth mode
  const handleProgressStep = () => {
    if (authStep === 'email') {
      if (isEmailValid) {
        setAuthStep("password");
      }
    } else if (authStep === 'password') {
      if (isPasswordValid) {
        if (authMode === 'signin') {
          executeSignIn();
        } else {
          setAuthStep("confirmPassword");
        }
      }
    }
  };

  // Execute demo login instantly (bypasses any unseeded/offline database)
  const executeDemoLogin = async () => {
    setModalStatus('loading');
    try {
      AuthService.createDemoOperatorSession();
      const loadingStepsCount = modalSteps.length - 1;
      const totalDuration = loadingStepsCount * TEXT_LOOP_INTERVAL * 1000;
      setTimeout(() => {
        fireSideCanons();
        setModalStatus('success');
        setTimeout(() => {
          router.push(onSuccessRedirect);
        }, 1000);
      }, totalDuration);
    } catch (err: any) {
      setModalErrorMessage(err.message || "Failed to initialize demo session.");
      setModalStatus('error');
    }
  };

  // Execute sign in for existing user
  const executeSignIn = async () => {
    setModalStatus('loading');
    setModalErrorCode('');
    try {
      await AuthService.login(email, password);
      const loadingStepsCount = modalSteps.length - 1;
      const totalDuration = loadingStepsCount * TEXT_LOOP_INTERVAL * 1000;
      setTimeout(() => {
        fireSideCanons();
        setModalStatus('success');
        setTimeout(() => {
          router.push(onSuccessRedirect);
        }, 1000);
      }, totalDuration);
    } catch (err: any) {
      const code = err.code || '';
      const raw = err.message || '';
      setModalErrorCode(code);

      if (
        code === 'ACCOUNT_NOT_FOUND' ||
        raw.includes('No account found') ||
        raw.toLowerCase().includes('create an account') ||
        err.status === 404
      ) {
        setModalErrorCode('ACCOUNT_NOT_FOUND');
        setModalErrorMessage("No account found with this email. Please create an account.");
      } else if (
        code === 'INVALID_CREDENTIALS' ||
        raw.includes('Incorrect password') ||
        raw === 'Unauthorized' ||
        err.status === 401
      ) {
        setModalErrorCode('INVALID_CREDENTIALS');
        setModalErrorMessage("Incorrect password. Please try again.");
      } else if (code === 'DATABASE_UNAVAILABLE' || err.status === 503) {
        setModalErrorCode('DATABASE_UNAVAILABLE');
        setModalErrorMessage("Database service is currently unreachable. Please check your connection or try again later.");
      } else {
        setModalErrorMessage(raw || 'Authentication failed. Please verify your credentials.');
      }
      setModalStatus('error');
    }
  };

  // Final submit for new account registration
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (modalStatus !== 'closed') return;

    if (authStep === 'password' && authMode === 'signin') {
      executeSignIn();
      return;
    }

    if (authStep === 'confirmPassword') {
      if (password !== confirmPassword) {
        setModalErrorCode('PASSWORD_MISMATCH');
        setModalErrorMessage("Passwords do not match!");
        setModalStatus('error');
        return;
      }

      setModalStatus('loading');
      setModalErrorCode('');
      try {
        const finalUsername = username.trim() || email.split('@')[0];
        if (oauthData) {
          await AuthService.syncOAuth({
            provider: oauthData.provider,
            provider_user_id: oauthData.provider_user_id,
            email: oauthData.email,
            full_name: oauthData.name,
            avatar_url: oauthData.avatar_url,
            username: finalUsername,
            password: password,
          });
        } else {
          await AuthService.register(finalUsername, email, password);
        }
        const loadingStepsCount = modalSteps.length - 1;
        const totalDuration = loadingStepsCount * TEXT_LOOP_INTERVAL * 1000;
        setTimeout(() => {
          fireSideCanons();
          setModalStatus('success');
          setTimeout(() => {
            router.push(onSuccessRedirect);
          }, 1000);
        }, totalDuration);
      } catch (err: any) {
        const code = err.code || '';
        const raw = err.message || '';
        setModalErrorCode(code);
        if (code === 'EMAIL_ALREADY_EXISTS' || raw.includes('already exists')) {
          setModalErrorMessage("An account with this email already exists. Please sign in instead.");
        } else {
          setModalErrorMessage(raw || "Unable to register account. Please try again.");
        }
        setModalStatus('error');
      }
    }
  };

  // Real OAuth Login handler
  const handleSocialAuth = (provider: 'google' | 'github') => {
    setModalStatus('loading');
    try {
      const authUrl = AuthService.getOAuthAuthorizationUrl(provider);
      if (authUrl && authUrl !== '#') {
        setTimeout(() => {
          window.location.href = authUrl;
        }, 400);
      } else {
        setModalErrorMessage(`Failed to initialize ${provider} login. Please try again.`);
        setModalStatus('error');
      }
    } catch (err: any) {
      setModalErrorMessage(err.message || `${provider} authorization failed.`);
      setModalStatus('error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (authStep === "email" && isEmailValid) {
        handleProgressStep();
      } else if (authStep === "password") {
        if (authMode === 'signin' && isPasswordValid) {
          executeSignIn();
        } else if (authMode !== 'signin' && isPasswordValid) {
          handleProgressStep();
        }
      }
    }
  };

  const handleGoBack = () => {
    if (authStep === "confirmPassword") setAuthStep("password");
    else if (authStep === "password") setAuthStep("email");
  };

  const closeModal = () => {
    setModalStatus('closed');
    setModalErrorMessage('');
    setModalErrorCode('');
  };

  useEffect(() => {
    if (authStep === 'password') setTimeout(() => passwordInputRef.current?.focus(), 500);
    else if (authStep === 'confirmPassword') setTimeout(() => confirmPasswordInputRef.current?.focus(), 500);
  }, [authStep]);

  useEffect(() => {
    if (modalStatus === 'success') {
      fireSideCanons();
    }
  }, [modalStatus]);

  const Modal = () => (
    <AnimatePresence>
      {modalStatus !== 'closed' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className={cn(
              "relative rounded-2xl p-8 w-full max-w-sm flex flex-col items-center gap-4 mx-4 shadow-2xl backdrop-blur-xl transition-colors duration-300",
              isDark
                ? "bg-[#0A0A0C]/95 border border-white/15 text-white"
                : "bg-[#FAF8F5]/95 border border-black/15 text-[#1A1815]"
            )}
          >
            {(modalStatus === 'error' || modalStatus === 'success') && (
              <button
                onClick={closeModal}
                className={cn(
                  "absolute top-3 right-3 p-1 rounded-full transition-colors",
                  isDark ? "text-white/60 hover:text-white hover:bg-white/10" : "text-[#1A1815]/60 hover:text-[#1A1815] hover:bg-black/5"
                )}
              >
                <X className="w-5 h-5" />
              </button>
            )}
            {modalStatus === 'error' && (
              <>
                <AlertCircle className="w-12 h-12 text-rose-500" />
                <p className="text-sm font-medium text-center leading-relaxed">
                  {modalErrorMessage}
                </p>
                <div className="flex flex-col gap-2 w-full mt-2">
                  {modalErrorCode === 'ACCOUNT_NOT_FOUND' || modalErrorMessage.includes('No account found') ? (
                    <>
                      <button
                        onClick={() => {
                          closeModal();
                          setAuthMode('signup');
                          setAuthStep('password');
                        }}
                        className={cn(
                          "w-full px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer shadow-md",
                          "bg-emerald-600 hover:bg-emerald-500 text-white"
                        )}
                      >
                        Create an Account Now
                      </button>
                      <button
                        onClick={() => {
                          closeModal();
                          setAuthStep('email');
                        }}
                        className={cn(
                          "w-full px-5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer",
                          isDark
                            ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                            : "bg-[#1A1815] hover:bg-black text-white"
                        )}
                      >
                        Try Different Email
                      </button>
                    </>
                  ) : modalErrorCode === 'EMAIL_ALREADY_EXISTS' || modalErrorMessage.includes('already exists') ? (
                    <>
                      <button
                        onClick={() => {
                          closeModal();
                          setAuthMode('signin');
                          setAuthStep('password');
                        }}
                        className={cn(
                          "w-full px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer shadow-md",
                          "bg-emerald-600 hover:bg-emerald-500 text-white"
                        )}
                      >
                        Sign In Now
                      </button>
                      <button
                        onClick={() => {
                          closeModal();
                          setAuthStep('email');
                        }}
                        className={cn(
                          "w-full px-5 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer",
                          isDark ? "bg-white/10 hover:bg-white/20 text-white" : "bg-black/10 hover:bg-black/20 text-[#1A1815]"
                        )}
                      >
                        Try Another Email
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          closeModal();
                          setPassword('');
                        }}
                        className={cn(
                          "w-full px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer",
                          isDark
                            ? "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                            : "bg-[#1A1815] hover:bg-black text-white"
                        )}
                      >
                        Try Again
                      </button>
                      <button
                        onClick={() => {
                          closeModal();
                          setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                          setAuthStep('password');
                        }}
                        className="w-full px-5 py-1.5 rounded-full text-xs font-semibold text-emerald-500 hover:underline cursor-pointer text-center"
                      >
                        {authMode === 'signin' ? "Need an account? Sign up" : "Already have an account? Sign in"}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
            {modalStatus === 'loading' && (
              <TextLoop interval={TEXT_LOOP_INTERVAL} stopOnEnd={true}>
                {modalSteps.slice(0, -1).map((step, i) => (
                  <div key={i} className="flex flex-col items-center gap-4 text-center">
                    {step.icon}
                    <p className="text-base font-medium font-mono">{step.message}</p>
                  </div>
                ))}
              </TextLoop>
            )}
            {modalStatus === 'success' && (
              <div className="flex flex-col items-center gap-4 text-center">
                {modalSteps[modalSteps.length - 1].icon}
                <p className="text-base font-medium font-mono">{modalSteps[modalSteps.length - 1].message}</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div
      className={cn(
        "min-h-screen w-screen flex flex-col justify-between font-sans relative overflow-hidden transition-colors duration-500",
        isDark
          ? "bg-[#000000] text-white selection:bg-[#E8E2D5] selection:text-black"
          : "bg-[#E8DEC8] text-[#1A1815] selection:bg-[#1A1815] selection:text-white"
      )}
    >
      <Confetti ref={confettiRef} manualstart className="fixed top-0 left-0 w-full h-full pointer-events-none z-[999]" />
      <Modal />

      {/* Atmospheric Background Lighting (Subtle, luxury, authentic to website) */}
      <div suppressHydrationWarning className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {isDark ? (
          <>
            {/* Dark Mode Atmosphere: Pure black base + soft neural emerald/gold aura */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[550px] rounded-full blur-[110px] opacity-60"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.08) 0%, rgba(232, 222, 200, 0.03) 45%, transparent 75%)',
              }}
            />
            <motion.div
              animate={{ x: [0, 20, 0], y: [0, -15, 0] }}
              transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-20 right-1/4 w-[350px] h-[350px] rounded-full blur-[90px] opacity-35 bg-emerald-500/10"
            />
            <motion.div
              animate={{ x: [0, -20, 0], y: [0, 15, 0] }}
              transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute bottom-10 left-1/4 w-[400px] h-[400px] rounded-full blur-[110px] opacity-25 bg-amber-500/10"
            />
          </>
        ) : (
          <>
            {/* Light Mode Atmosphere: Pure warm cream base (#E8DEC8) + soft champagne warmth */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full blur-[110px] opacity-80"
              style={{
                background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.65) 0%, rgba(232, 222, 200, 0.25) 55%, transparent 80%)',
              }}
            />
            <motion.div
              animate={{ x: [0, 15, 0], y: [0, -12, 0] }}
              transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -top-10 right-1/4 w-[350px] h-[350px] rounded-full blur-[80px] opacity-60 bg-white/70"
            />
            <motion.div
              animate={{ x: [0, -15, 0], y: [0, 12, 0] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute bottom-10 left-1/4 w-[400px] h-[400px] rounded-full blur-[100px] opacity-40 bg-[#DFD3BC]"
            />
          </>
        )}
        {/* Subtle Film Grain Texture (Exact website texture) */}
        <div className="grain" />
      </div>

      {/* TOP HEADER: BRAND LOGO (LEFT) & THEME SWITCHER + BACK LINK (RIGHT) */}
      <header className="relative z-30 w-full px-4 sm:px-8 pt-5 pb-3 flex items-center justify-between">
        {/* Brand Logo (Left) */}
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 group cursor-pointer transition-all duration-300"
          aria-label="VisionPlate.ai Home"
        >
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300",
              isDark
                ? "bg-white/[0.08] border border-white/20 text-white group-hover:border-white/50 group-hover:shadow-[0_0_14px_rgba(255,255,255,0.3)]"
                : "bg-black/[0.05] border border-black/15 text-[#1A1815] group-hover:border-black/40 group-hover:shadow-[0_0_10px_rgba(0,0,0,0.12)]"
            )}
          >
            <Shield className="w-4 h-4 text-emerald-500" />
          </div>
          <span
            className={cn(
              "text-base font-bold font-mono tracking-tight transition-colors",
              isDark ? "text-white" : "text-[#1A1815]"
            )}
          >
            VisionPlate<span className="text-emerald-500 font-sans text-xs">.ai</span>
          </span>
        </Link>

        {/* Theme Switcher & Back to Website (Right) */}
        <div className="flex items-center gap-2 sm:gap-3">
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className={cn(
                "w-8 sm:w-9 h-8 sm:h-9 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer",
                isDark
                  ? "text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 hover:shadow-[0_0_16px_rgba(251,191,36,0.45)] hover:scale-105"
                  : "text-slate-800 hover:text-black hover:bg-black/5 hover:shadow-[0_0_12px_rgba(0,0,0,0.15)] hover:scale-105"
              )}
              title={isDark ? "Switch to Beige Mode" : "Switch to Dark Mode"}
              aria-label="Toggle Theme"
            >
              {isDark ? (
                <Sun className="w-4 h-4 transition-transform duration-500 hover:rotate-90" />
              ) : (
                <Moon className="w-4 h-4 transition-transform duration-500 hover:-rotate-12" />
              )}
            </button>
          )}

          <Link
            href="/"
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-300 shadow-sm cursor-pointer",
              isDark
                ? "border border-white/15 bg-white/[0.06] text-white/80 hover:text-white hover:bg-white/[0.12] hover:border-white/30"
                : "border border-black/15 bg-white/70 text-[#1A1815]/80 hover:text-[#1A1815] hover:bg-white hover:border-black/30"
            )}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to</span> Website
          </Link>
        </div>
      </header>

      {/* MAIN FORM CANVAS (Floating directly on screen without box container) */}
      <main className="flex-1 w-full flex items-center justify-center relative z-10 px-4 py-8">
        <fieldset disabled={modalStatus !== 'closed'} className="relative z-10 flex flex-col items-center gap-7 w-[320px] mx-auto">
          <AnimatePresence mode="wait">
            {authStep === "email" && (
              <motion.div
                key="email-content"
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full flex flex-col items-center gap-4 text-center"
              >
                <BlurFade delay={0.15 * 1} className="w-full">
                  <p
                    className={cn(
                      "font-serif-italic font-normal text-4xl sm:text-5xl md:text-6xl tracking-tight whitespace-nowrap",
                      isDark ? "text-white" : "text-[#1A1815]"
                    )}
                  >
                    {authMode === 'signin' ? "Welcome Back" : "Get started with Us"}
                  </p>
                </BlurFade>

                <BlurFade delay={0.15 * 2}>
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isDark ? "text-white/60" : "text-[#1A1815]/65"
                    )}
                  >
                    {authMode === 'signin'
                      ? "Sign in to access your telemetry dashboard"
                      : "Create your operator account"}
                  </p>
                </BlurFade>

                <BlurFade delay={0.15 * 3}>
                  <div className="flex items-center justify-center gap-3.5 w-full">
                    {/* Google Button */}
                    <button
                      type="button"
                      onClick={() => handleSocialAuth('google')}
                      className={cn(
                        "flex items-center justify-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 shadow-sm cursor-pointer",
                        isDark
                          ? "bg-white/[0.08] hover:bg-white/[0.14] border border-white/16 text-white hover:border-white/30 hover:scale-[1.02]"
                          : "bg-white/80 hover:bg-white border border-black/15 text-[#1A1815] hover:border-black/30 hover:shadow-md hover:scale-[1.02]"
                      )}
                    >
                      <GoogleIcon />
                      <span>Google</span>
                    </button>

                    {/* GitHub Button */}
                    <button
                      type="button"
                      onClick={() => handleSocialAuth('github')}
                      className={cn(
                        "flex items-center justify-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 shadow-sm cursor-pointer",
                        isDark
                          ? "bg-white/[0.08] hover:bg-white/[0.14] border border-white/16 text-white hover:border-white/30 hover:scale-[1.02]"
                          : "bg-white/80 hover:bg-white border border-black/15 text-[#1A1815] hover:border-black/30 hover:shadow-md hover:scale-[1.02]"
                      )}
                    >
                      <GitHubIcon />
                      <span>GitHub</span>
                    </button>
                  </div>
                </BlurFade>

                <BlurFade delay={0.15 * 4} className="w-[300px]">
                  <div className="flex items-center w-full gap-2 py-1.5">
                    <hr className={cn("w-full border-t", isDark ? "border-white/15" : "border-black/15")} />
                    <span className={cn("text-xs font-semibold uppercase tracking-wider", isDark ? "text-white/45" : "text-[#1A1815]/50")}>
                      OR
                    </span>
                    <hr className={cn("w-full border-t", isDark ? "border-white/15" : "border-black/15")} />
                  </div>
                </BlurFade>
              </motion.div>
            )}

            {authStep === "password" && (
              <motion.div
                key="password-title"
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full flex flex-col items-center text-center gap-3"
              >
                <BlurFade delay={0} className="w-full">
                  <p
                    className={cn(
                      "font-serif-italic font-normal text-4xl sm:text-5xl tracking-tight whitespace-nowrap",
                      isDark ? "text-white" : "text-[#1A1815]"
                    )}
                  >
                    {authMode === 'signin' ? "Welcome Back" : oauthData ? "Set Up Account" : "Create Password"}
                  </p>
                </BlurFade>
                <BlurFade delay={0.15}>
                  <p className={cn("text-sm font-medium", isDark ? "text-white/60" : "text-[#1A1815]/65")}>
                    {authMode === 'signin'
                      ? "Enter your password to sign in."
                      : oauthData
                      ? "Choose a username and password to complete registration."
                      : "Set your username and password (at least 6 characters)."}
                  </p>
                </BlurFade>
              </motion.div>
            )}

            {authStep === "confirmPassword" && (
              <motion.div
                key="confirm-title"
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full flex flex-col items-center text-center gap-3"
              >
                <BlurFade delay={0} className="w-full">
                  <p
                    className={cn(
                      "font-serif-italic font-normal text-4xl sm:text-5xl tracking-tight whitespace-nowrap",
                      isDark ? "text-white" : "text-[#1A1815]"
                    )}
                  >
                    One Last Step
                  </p>
                </BlurFade>
                <BlurFade delay={0.15}>
                  <p className={cn("text-sm font-medium", isDark ? "text-white/60" : "text-[#1A1815]/65")}>
                    Confirm your password to continue
                  </p>
                </BlurFade>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleFinalSubmit} className="w-[300px] space-y-4">
            <AnimatePresence>
              {authStep !== "confirmPassword" && (
                <motion.div
                  key="email-password-fields"
                  exit={{ opacity: 0, filter: "blur(4px)" }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="w-full space-y-4"
                >
                  <BlurFade delay={authStep === "email" ? 0.15 * 5 : 0} inView={true} className="w-full">
                    <div className="relative w-full">
                      <AnimatePresence>
                        {authStep === "password" && (
                          <motion.div
                            initial={{ y: -8, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.3, delay: 0.3 }}
                            className="absolute -top-5 left-3 z-10"
                          >
                            <label className={cn("text-xs font-semibold", isDark ? "text-white/60" : "text-[#1A1815]/65")}>
                              {authMode === 'signin' ? "Email / Username" : "Email"}
                            </label>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <div className="glass-input-wrap w-full">
                        <div
                          className={cn(
                            "glass-input shadow-sm transition-all duration-300",
                            isDark
                              ? "bg-white/[0.08] border border-white/18 focus-within:border-emerald-500 focus-within:shadow-[0_0_18px_rgba(16,185,129,0.25)]"
                              : "bg-white/80 border border-black/16 focus-within:border-emerald-600 focus-within:shadow-[0_0_16px_rgba(5,150,105,0.2)]"
                          )}
                        >
                          <div
                            className={cn(
                              "relative z-10 flex-shrink-0 flex items-center justify-center overflow-hidden transition-all duration-300 ease-in-out",
                              email.length > 20 && authStep === "email" ? "w-0 px-0" : "w-10 pl-2"
                            )}
                          >
                            <Mail className={cn("h-4 w-4 flex-shrink-0", isDark ? "text-white/70" : "text-[#1A1815]/70")} />
                          </div>
                          <input
                            type={authMode === 'signin' ? "text" : "email"}
                            placeholder={authMode === 'signin' ? "Email or Username" : "Email"}
                            value={email}
                            disabled={Boolean(oauthData)}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className={cn(
                              "relative z-10 h-full w-0 flex-grow bg-transparent text-sm focus:outline-none transition-[padding-right] duration-300 ease-in-out delay-300",
                              isDark ? "text-white placeholder:text-white/40" : "text-[#1A1815] placeholder:text-[#1A1815]/45",
                              isEmailValid && authStep === "email" ? "pr-2" : "pr-0"
                            )}
                          />
                          <div
                            className={cn(
                              "relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out",
                              isEmailValid && authStep === "email" ? "w-9 pr-1" : "w-0"
                            )}
                          >
                            <button
                              type="button"
                              onClick={handleProgressStep}
                              aria-label="Continue"
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer",
                                isDark
                                  ? "bg-white text-black hover:bg-white/90 shadow-sm"
                                  : "bg-[#1A1815] text-white hover:bg-black shadow-sm"
                              )}
                            >
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </BlurFade>

                  {authStep === "email" && (
                    <BlurFade delay={0.15 * 6} inView={true} className="w-full space-y-3 pt-1">
                      {/* Mode toggle */}
                      <div className="flex items-center justify-center gap-1.5 text-xs">
                        <span className={isDark ? "text-white/60" : "text-[#1A1815]/65"}>
                          {authMode === 'signin' ? "Don't have an account?" : "Already have an account?"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
                            setAuthStep('email');
                          }}
                          className={cn(
                            "font-semibold underline cursor-pointer transition-colors",
                            isDark ? "text-emerald-400 hover:text-emerald-300" : "text-emerald-700 hover:text-emerald-900"
                          )}
                        >
                          {authMode === 'signin' ? "Sign Up" : "Sign In"}
                        </button>
                      </div>
                    </BlurFade>
                  )}

                  <AnimatePresence>
                    {authStep === "password" && (
                      <BlurFade key="password-fields-wrap" className="w-full space-y-3.5">
                        {oauthData && (
                          <div className={cn(
                            "w-full px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 border",
                            isDark
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                              : "bg-emerald-50 border-emerald-300 text-emerald-800"
                          )}>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            <span className="truncate">Verified via {oauthData.provider === 'google' ? 'Google' : 'GitHub'}: {oauthData.email}</span>
                          </div>
                        )}

                        {/* Optional / Recommended Username Input for Sign Up */}
                        {authMode === 'signup' && (
                          <div className="relative w-full">
                            <AnimatePresence>
                              {username.length > 0 && (
                                <motion.div
                                  initial={{ y: -8, opacity: 0 }}
                                  animate={{ y: 0, opacity: 1 }}
                                  transition={{ duration: 0.3 }}
                                  className="absolute -top-5 left-3 z-10"
                                >
                                  <label className={cn("text-xs font-semibold", isDark ? "text-white/60" : "text-[#1A1815]/65")}>
                                    Username
                                  </label>
                                </motion.div>
                              )}
                            </AnimatePresence>
                            <div className="glass-input-wrap w-full">
                              <div
                                className={cn(
                                  "glass-input shadow-sm transition-all duration-300",
                                  isDark
                                    ? "bg-white/[0.08] border border-white/18 focus-within:border-emerald-500 focus-within:shadow-[0_0_18px_rgba(16,185,129,0.25)]"
                                    : "bg-white/80 border border-black/16 focus-within:border-emerald-600 focus-within:shadow-[0_0_16px_rgba(5,150,105,0.2)]"
                                )}
                              >
                                <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                                  <span className={cn("text-xs font-mono font-bold", isDark ? "text-white/70" : "text-[#1A1815]/70")}>@</span>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Choose Username"
                                  value={username}
                                  onChange={(e) => setUsername(e.target.value)}
                                  className={cn(
                                    "relative z-10 h-full w-0 flex-grow bg-transparent text-sm focus:outline-none",
                                    isDark ? "text-white placeholder:text-white/40" : "text-[#1A1815] placeholder:text-[#1A1815]/45"
                                  )}
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Password Input */}
                        <div className="relative w-full">
                          <AnimatePresence>
                            {password.length > 0 && (
                              <motion.div
                                initial={{ y: -8, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ duration: 0.3 }}
                                className="absolute -top-5 left-3 z-10"
                              >
                                <label className={cn("text-xs font-semibold", isDark ? "text-white/60" : "text-[#1A1815]/65")}>
                                  Password
                                </label>
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <div className="glass-input-wrap w-full">
                            <div
                              className={cn(
                                "glass-input shadow-sm transition-all duration-300",
                                isDark
                                  ? "bg-white/[0.08] border border-white/18 focus-within:border-emerald-500 focus-within:shadow-[0_0_18px_rgba(16,185,129,0.25)]"
                                  : "bg-white/80 border border-black/16 focus-within:border-emerald-600 focus-within:shadow-[0_0_16px_rgba(5,150,105,0.2)]"
                              )}
                            >
                              <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                                {isPasswordValid ? (
                                  <button
                                    type="button"
                                    aria-label="Toggle password visibility"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className={cn(
                                      "p-1.5 rounded-full transition-colors cursor-pointer",
                                      isDark ? "text-white/70 hover:text-white" : "text-[#1A1815]/70 hover:text-[#1A1815]"
                                    )}
                                  >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                                ) : (
                                  <Lock className={cn("h-4 w-4 flex-shrink-0", isDark ? "text-white/70" : "text-[#1A1815]/70")} />
                                )}
                              </div>
                              <input
                                ref={passwordInputRef}
                                type={showPassword ? "text" : "password"}
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onKeyDown={handleKeyDown}
                                className={cn(
                                  "relative z-10 h-full w-0 flex-grow bg-transparent text-sm focus:outline-none",
                                  isDark ? "text-white placeholder:text-white/40" : "text-[#1A1815] placeholder:text-[#1A1815]/45"
                                )}
                              />
                              <div
                                className={cn(
                                  "relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out",
                                  isPasswordValid ? "w-9 pr-1" : "w-0"
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={handleProgressStep}
                                  aria-label="Submit password"
                                  className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer",
                                    isDark
                                      ? "bg-white text-black hover:bg-white/90 shadow-sm"
                                      : "bg-[#1A1815] text-white hover:bg-black shadow-sm"
                                  )}
                                >
                                  <ArrowRight className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <BlurFade inView delay={0.15}>
                          <div className="mt-3.5 flex items-center justify-between text-xs">
                            <button
                              type="button"
                              onClick={handleGoBack}
                              className={cn(
                                "flex items-center gap-1.5 transition-colors cursor-pointer",
                                isDark ? "text-white/65 hover:text-white" : "text-[#1A1815]/65 hover:text-[#1A1815]"
                              )}
                            >
                              <ArrowLeft className="w-3.5 h-3.5" /> Go back
                            </button>
                            {authMode === 'signin' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setAuthMode('signup');
                                  setAuthStep('password');
                                }}
                                className="text-emerald-500 hover:underline cursor-pointer font-medium"
                              >
                                Need an account? Sign up
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setAuthMode('signin');
                                  setAuthStep('password');
                                }}
                                className="text-emerald-500 hover:underline cursor-pointer font-medium"
                              >
                                Have an account? Sign in
                              </button>
                            )}
                          </div>
                        </BlurFade>
                      </BlurFade>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {authStep === "confirmPassword" && (
                <BlurFade key="confirm-password-field" className="w-full">
                  <div className="relative w-full">
                    <AnimatePresence>
                      {confirmPassword.length > 0 && (
                        <motion.div
                          initial={{ y: -8, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ duration: 0.3 }}
                          className="absolute -top-5 left-3 z-10"
                        >
                          <label className={cn("text-xs font-semibold", isDark ? "text-white/60" : "text-[#1A1815]/65")}>
                            Confirm Password
                          </label>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="glass-input-wrap w-full">
                      <div
                        className={cn(
                          "glass-input shadow-sm transition-all duration-300",
                          isDark
                            ? "bg-white/[0.08] border border-white/18 focus-within:border-emerald-500 focus-within:shadow-[0_0_18px_rgba(16,185,129,0.25)]"
                            : "bg-white/80 border border-black/16 focus-within:border-emerald-600 focus-within:shadow-[0_0_16px_rgba(5,150,105,0.2)]"
                        )}
                      >
                        <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-10 pl-2">
                          {isConfirmPasswordValid ? (
                            <button
                              type="button"
                              aria-label="Toggle confirm password visibility"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                              className={cn(
                                "p-1.5 rounded-full transition-colors cursor-pointer",
                                isDark ? "text-white/70 hover:text-white" : "text-[#1A1815]/70 hover:text-[#1A1815]"
                              )}
                            >
                              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          ) : (
                            <Lock className={cn("h-4 w-4 flex-shrink-0", isDark ? "text-white/70" : "text-[#1A1815]/70")} />
                          )}
                        </div>
                        <input
                          ref={confirmPasswordInputRef}
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm Password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={cn(
                            "relative z-10 h-full w-0 flex-grow bg-transparent text-sm focus:outline-none",
                            isDark ? "text-white placeholder:text-white/40" : "text-[#1A1815] placeholder:text-[#1A1815]/45"
                          )}
                        />
                        <div
                          className={cn(
                            "relative z-10 flex-shrink-0 overflow-hidden transition-all duration-300 ease-in-out",
                            isConfirmPasswordValid ? "w-9 pr-1" : "w-0"
                          )}
                        >
                          <button
                            type="submit"
                            aria-label="Finish sign-up"
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer",
                              isDark
                                ? "bg-white text-black hover:bg-white/90 shadow-sm"
                                : "bg-[#1A1815] text-white hover:bg-black shadow-sm"
                            )}
                          >
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <BlurFade inView delay={0.15}>
                    <button
                      type="button"
                      onClick={handleGoBack}
                      className={cn(
                        "mt-3.5 flex items-center gap-1.5 text-xs transition-colors cursor-pointer",
                        isDark ? "text-white/65 hover:text-white" : "text-[#1A1815]/65 hover:text-[#1A1815]"
                      )}
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Go back
                    </button>
                  </BlurFade>
                </BlurFade>
              )}
            </AnimatePresence>
          </form>
        </fieldset>
      </main>

      {/* FOOTER NOTE */}
      <footer
        className={cn(
          "relative z-10 py-3 text-center text-[11px] font-mono tracking-wider transition-colors",
          isDark ? "text-white/35" : "text-[#1A1815]/40"
        )}
      >
        VisionPlate AI • Enterprise ALPR Telemetry • 2026
      </footer>
    </div>
  );
};

export default AuthComponent;
