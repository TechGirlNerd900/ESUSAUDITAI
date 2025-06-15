import React, { Fragment, useState } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { 
  Bars3Icon, 
  BellIcon, 
  UserCircleIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

const Navbar = ({ setSidebarOpen }) => {
  const { user, logout } = useAuth();
  const [notificationCount] = useState(3);

  return (
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200/50 bg-white/80 backdrop-blur-md px-4 shadow-soft sm:gap-x-6 sm:px-6 lg:px-8">
      <button
        type="button"
        className="-m-2.5 p-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all duration-200 lg:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <span className="sr-only">Open sidebar</span>
        <Bars3Icon className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Separator */}
      <div className="h-6 w-px bg-gray-200 lg:hidden" aria-hidden="true" />

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="relative flex flex-1 items-center">
          <div className="flex items-center">
            <div className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg mr-3 shadow-soft">
              <SparklesIcon className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Esus Audit AI
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* Notifications */}
          <button
            type="button"
            className="relative -m-2.5 p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-200 group"
          >
            <span className="sr-only">View notifications</span>
            <BellIcon className="h-6 w-6 group-hover:scale-110 transition-transform duration-200" aria-hidden="true" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                {notificationCount}
              </span>
            )}
          </button>

          {/* Separator */}
          <div
            className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200"
            aria-hidden="true"
          />

          {/* Profile dropdown */}
          <Menu as="div" className="relative">
            <Menu.Button className="-m-1.5 flex items-center p-1.5 hover:bg-gray-100 rounded-lg transition-all duration-200 group">
              <span className="sr-only">Open user menu</span>
              <div className="relative">
                <UserCircleIcon className="h-8 w-8 text-gray-400 group-hover:text-gray-600 transition-colors duration-200" />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
              </div>
              <span className="hidden lg:flex lg:items-center">
                <span
                  className="ml-4 text-sm font-semibold leading-6 text-gray-900 group-hover:text-gray-700 transition-colors duration-200"
                  aria-hidden="true"
                >
                  {user?.first_name} {user?.last_name}
                </span>
                <svg className="ml-2 h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom="transform opacity-0 scale-95 translate-y-1"
              enterTo="transform opacity-1 scale-100 translate-y-0"
              leave="transition ease-in duration-150"
              leaveFrom="transform opacity-1 scale-100 translate-y-0"
              leaveTo="transform opacity-0 scale-95 translate-y-1"
            >
              <Menu.Items className="absolute right-0 z-10 mt-3 w-48 origin-top-right rounded-xl bg-white py-2 shadow-hard ring-1 ring-gray-900/5 focus:outline-none border border-gray-100">
                <div className="px-3 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{user?.first_name} {user?.last_name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <Menu.Item>
                  {({ active }) => (
                    <Link
                      to="/settings"
                      className={clsx(
                        active ? 'bg-blue-50 text-blue-700' : 'text-gray-700',
                        'flex items-center px-3 py-2 text-sm font-medium transition-colors duration-200 mx-1 rounded-lg'
                      )}
                    >
                      <Cog6ToothIcon className="mr-3 h-4 w-4" />
                      Settings
                    </Link>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={logout}
                      className={clsx(
                        active ? 'bg-red-50 text-red-700' : 'text-gray-700',
                        'flex w-full items-center px-3 py-2 text-sm font-medium transition-colors duration-200 mx-1 rounded-lg'
                      )}
                    >
                      <ArrowRightOnRectangleIcon className="mr-3 h-4 w-4" />
                      Sign out
                    </button>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
