// pages/index.tsx
import React from 'react';
import { NextPage } from 'next';
import { useFinesse } from '@/hooks/useFinesse';
import { LoginForm } from '@/components/LoginForm';
import { AgentStatus } from '@/components/AgentStatus';
import { StateChanger } from '@/components/StateChanger';
import { TimerSettingsComponent } from '@/components/TimerSettings';
import { NotificationConfigComponent } from '@/components/NotificationConfig';
import { Header } from '@/components/Header';


const Home: NextPage = () => {
  const {
    agentStatus,
    isConnected,
    isLoading,
    error,
    credentials,
    timerSettings,
    notificationConfig,
    login,
    logout,
    changeAgentState,
    updateTimerSettings,
    updateNotificationConfig,
    testNotification,
    refreshStatus,
  } = useFinesse();

  const handleExternalLinks = {
    openDocs: () => window.open('https://tdn.totvs.com/pages/viewpage.action?pageId=961629221', '_blank'),
    openStore: () => window.open('https://chromewebstore.google.com/detail/finesse-notifier/cglkkcedledghdpkbopambajgmjmkkab', '_blank'),
    openFeedback: () => window.open('https://docs.google.com/forms/d/e/1FAIpQLSeeMiF6LywX6OfRddaWB1igSbn0TylLtRUy28AFWNP4KpC4iA/viewform?usp=dialog', '_blank'),
  };

  const getAgentName = () => {
    if (!agentStatus || !agentStatus.firstName || !agentStatus.lastName) return undefined;
    return `${agentStatus.firstName.text} ${agentStatus.lastName.text}`;
  };

  if (isLoading && !credentials) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-4 text-lg text-gray-600">Carregando...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!credentials) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md mx-auto">
            <LoginForm
              onLogin={login}
              isLoading={isLoading}
              error={error}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header
        agentName={getAgentName()}
        onLogout={logout}
        onOpenDocs={handleExternalLinks.openDocs}
        onOpenStore={handleExternalLinks.openStore}
        onOpenFeedback={handleExternalLinks.openFeedback}
      />

      <main className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <AgentStatus
            status={agentStatus}
            isConnected={isConnected}
            onRefresh={refreshStatus}
            isLoading={isLoading}
          />

          {credentials && (
            <StateChanger
              credentials={credentials}
              currentState={agentStatus?.state?.text}
              onStateChange={changeAgentState}
            />
          )}

          <TimerSettingsComponent
            settings={timerSettings}
            onUpdate={updateTimerSettings}
          />

          <NotificationConfigComponent
            config={notificationConfig}
            onUpdate={updateNotificationConfig}
            onTest={testNotification}
          />

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              <strong>Erro:</strong> {error}
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Por Rafael Arcanjo © TOTVS</span>
            <span>v2.0.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
