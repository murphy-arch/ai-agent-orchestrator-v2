import { useState, useEffect } from "react";
import {
  User,
  Loader2,
  Save,
  AlertCircle,
  Moon,
  Sun,
  Monitor,
  Trash2,
  KeyRound,
  CheckCircle2,
  ChevronLeft,
  Globe,
} from "lucide-react";
import { Link } from "react-router-dom";
import { trpc } from "@/trpc";
import { COMMON_TIMEZONES } from "@/lib/schedule-templates";

type Theme = "light" | "dark" | "system";

function ThemeToggle({
  theme,
  onChange,
}: {
  theme: Theme;
  onChange: (t: Theme) => void;
}) {
  const options: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: "light", icon: <Sun className="h-4 w-4" />, label: "Light" },
    { value: "dark", icon: <Moon className="h-4 w-4" />, label: "Dark" },
    { value: "system", icon: <Monitor className="h-4 w-4" />, label: "System" },
  ];

  return (
    <div className="flex items-center gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
            theme === opt.value
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function UserSettings() {
  const utils = trpc.useUtils();
  const { data: user, isLoading } = trpc.auth.me.useQuery();

  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [theme, setTheme] = useState<Theme>("light");
  const [error, setError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [timezoneSuccess, setTimezoneSuccess] = useState(false);

  // Load theme from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored) setTheme(stored);
  }, []);

  // Populate form when user data loads
  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
    if (user?.timezone) {
      setTimezone(user.timezone);
    }
  }, [user]);

  const updateProfile = trpc.settings.updateUserProfile.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    },
    onError: (err) => setError(err.message),
  });

  const updateTimezone = trpc.settings.updateUserTimezone.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      setTimezoneSuccess(true);
      setTimeout(() => setTimezoneSuccess(false), 3000);
    },
    onError: (err) => setError(err.message),
  });

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Name cannot be empty");
      return;
    }
    updateProfile.mutate({ name: name.trim() });
  };

  const handleTimezoneChange = (newTz: string) => {
    setTimezone(newTz);
    setError("");
    updateTimezone.mutate({ timezone: newTz });
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);

    const root = document.documentElement;
    root.classList.remove("light", "dark");

    if (newTheme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) root.classList.add("dark");
      else root.classList.add("light");
    } else {
      root.classList.add(newTheme);
    }
  };

  const changePassword = trpc.settings.changePassword.useMutation({
    onSuccess: () => {
      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
    onError: (err) => setError(err.message),
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            to="/dashboard"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
          <div className="h-6 w-px bg-gray-200" />
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100">
            <User className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Account Settings</h1>
            <p className="text-xs text-gray-500">Manage your profile and preferences</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {/* Profile Section */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Profile</h2>
          </div>
          <form onSubmit={handleUpdateProfile} className="space-y-4 px-5 py-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={user?.email ?? ""}
                disabled
                className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
              />
              <p className="mt-1 text-xs text-gray-400">Email cannot be changed</p>
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Display Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {profileSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                Profile updated successfully
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={updateProfile.isPending || name === (user?.name ?? "")}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Save className="h-4 w-4" />
                Update Profile
              </button>
            </div>
          </form>
        </section>

        {/* Theme Section */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Appearance</h2>
          </div>
          <div className="px-5 py-4">
            <label className="mb-3 block text-sm font-medium text-gray-700">Theme</label>
            <ThemeToggle theme={theme} onChange={handleThemeChange} />
          </div>
        </section>

        {/* Timezone Section */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Globe className="h-4 w-4 text-gray-500" />
              Timezone
            </h2>
          </div>
          <div className="space-y-4 px-5 py-4">
            <p className="text-xs text-gray-500">
              Your timezone is used for all schedules. Times are stored in your local timezone and converted automatically.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Select Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:w-80"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            {timezoneSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                Timezone updated successfully
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => handleTimezoneChange(timezone)}
                disabled={updateTimezone.isPending || timezone === (user?.timezone ?? "UTC")}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updateTimezone.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Save className="h-4 w-4" />
                Save Timezone
              </button>
            </div>
          </div>
        </section>

        {/* Password Section */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <KeyRound className="h-4 w-4 text-gray-500" />
              Change Password
            </h2>
          </div>
          <form onSubmit={handlePasswordChange} className="space-y-4 px-5 py-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {passwordSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                Password updated successfully
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={changePassword.isPending}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {changePassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <KeyRound className="h-4 w-4" />
                Update Password
              </button>
            </div>
          </form>
        </section>

        {/* Danger Zone */}
        <section className="rounded-xl border border-red-200 bg-white shadow-sm">
          <div className="border-b border-red-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-red-700">Danger Zone</h2>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Delete Account</p>
                <p className="text-xs text-gray-500">
                  Permanently delete your account and all associated data. This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => {
                  alert("Account deletion is not yet implemented.");
                }}
                className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
                Delete Account
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
