import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { 
  XMarkIcon,
  HomeIcon,
  FolderIcon,
  DocumentTextIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  SparklesIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, color: 'text-blue-600', bgColor: 'bg-blue-50' },
  { name: 'Projects', href: '/projects', icon: FolderIcon, color: 'text-green-600', bgColor: 'bg-green-50' },
  { name: 'Documents', href: '/documents', icon: DocumentTextIcon, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  { name: 'Reports', href: '/reports', icon: ChartBarIcon, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon, color: 'text-gray-600', bgColor: 'bg-gray-50' },
];

const Sidebar = ({ open, setOpen }) => {
  const location = useLocation();

  const SidebarContent = () => (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-gradient-to-b from-white to-gray-50/50 px-6 pb-4">
      <div className="flex h-16 shrink-0 items-center">
        <div className="flex items-center group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-soft group-hover:shadow-medium transition-all duration-200">
            <SparklesIcon className="h-5 w-5 text-white" />
          </div>
          <div className="ml-3">
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Esus Audit AI
            </span>
            <div className="flex items-center text-xs text-gray-500 mt-0.5">
              <ShieldCheckIcon className="h-3 w-3 mr-1" />
              <span>Secure & Compliant</span>
            </div>
          </div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={clsx(
                        isActive
                          ? `${item.bgColor} ${item.color} shadow-soft border-r-2 border-current`
                          : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50',
                        'group flex gap-x-3 rounded-lg p-3 text-sm leading-6 font-medium transition-all duration-200 hover:scale-[1.02] hover:shadow-soft'
                      )}
                    >
                      <div className={clsx(
                        isActive ? 'scale-110' : 'group-hover:scale-110',
                        'transition-transform duration-200'
                      )}>
                        <item.icon
                          className={clsx(
                            isActive
                              ? item.color
                              : 'text-gray-400 group-hover:text-gray-600',
                            'h-5 w-5 shrink-0'
                          )}
                          aria-hidden="true"
                        />
                      </div>
                      <span className={clsx(
                        isActive ? 'font-semibold' : 'group-hover:font-medium'
                      )}>
                        {item.name}
                      </span>
                      {isActive && (
                        <div className="ml-auto">
                          <div className="h-2 w-2 bg-current rounded-full animate-pulse"></div>
                        </div>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
          <li className="mt-auto">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ShieldCheckIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-xs font-medium text-blue-900">Security Status</p>
                  <p className="text-xs text-blue-700">All systems secure</p>
                </div>
              </div>
            </div>
          </li>
        </ul>
      </nav>
    </div>
  );

  return (
    <>
      {/* Mobile sidebar */}
      <Transition.Root show={open} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                    <button
                      type="button"
                      className="-m-2.5 p-2.5"
                      onClick={() => setOpen(false)}
                    >
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>
                <SidebarContent />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Static sidebar for desktop */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200/50 shadow-soft">
          <SidebarContent />
        </div>
      </div>
    </>
  );
};

export default Sidebar;
