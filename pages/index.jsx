/* eslint-disable brace-style */
import { addSeconds, differenceInSeconds, formatDistanceStrict } from 'date-fns'
import Head from 'next/head'
import { useEffect, useReducer, useState } from 'react'
import bellSound from '../assets/audio/bell.mp3'
// import useSound from 'use-sound'

const initialState = {
  tasks: [],
  active: null
}

const initializer = (initialValue = initialState) => {
  if (typeof window !== 'undefined') {
    return JSON.parse(localStorage.getItem('store')) || initialValue
  }
  return initialValue
}

function reducer (state, action) {
  switch (action.type) {
    case 'add_task':
      return {
        ...state,
        tasks: [action.payload, ...state.tasks]
      }
    case 'remove_task':
      return {
        ...state,
        tasks: state.tasks.filter(f => f.id !== action.id)
      }
    case 'start_timer': {
      let tasks = state.tasks.filter(f => f.id !== action.id)

      const target = state.tasks.find(f => f.id === action.id)
      if (!target.timers) {
        target.timers = []
      }

      // Pause & remove from active
      if (target.id === state.active) {
        target.timers = target.timers.map(m => {
          if (m.active) {
            return {
              ...m,
              finish: (new Date()).getTime(),
              active: false
            }
          }

          return m
        })
        console.log('target is same with active task', target.timers)
      } else {
        tasks = tasks.map(m => {
          if (state.active === m.id) {
            console.log('started task is not same', m)
            m.timers = m.timers.map(t => {
              if (t.active) {
                return {
                  ...t,
                  finish: (new Date()).getTime(),
                  active: false
                }
              }
              return t
            })
            m.elapsed = m.timers.reduce((total, timer) => {
              if (timer.start && timer.finish) {
                total += differenceInSeconds(new Date(timer.finish), new Date(timer.start))
              }
              return total
            }, 0)
          }
          return m
        })
      }

      if (target.id !== state.active) {
        // Start timer & set active

        const nextIsShortBreak = () => {
          const lastTimer = target.timers?.slice(-1)
          let isBreak = false
          if (lastTimer?.length && !(lastTimer[0].isBreak || lastTimer[0].isLongBreak)) {
            isBreak = true
          }
          console.log('nextisshortbreak?', isBreak)
          return isBreak
        }
        const nextIsLongBreak = () => {
          const lastTimers = target.timers?.slice(-7)
          const isBreak = lastTimers.filter(f => f.isBreak).length === 3
          console.log('nextislongbreak?', isBreak)
          return isBreak
        }

        target.timers.push({
          start: (new Date()).getTime(),
          finish: null,
          active: true,
          isLongBreak: nextIsLongBreak() && nextIsShortBreak(),
          isBreak: nextIsShortBreak() && !nextIsLongBreak()
        })
      } else {
        // Calculate total spend
        target.elapsed = target.timers.reduce((total, timer) => {
          if (timer.start && timer.finish) {
            total += differenceInSeconds(new Date(timer.finish), new Date(timer.start))
          }
          return total
        }, 0)
      }

      tasks = [target, ...tasks]
      return {
        ...state,
        tasks,
        active: action.id === state.active ? null : action.id
      }
    }
    default:
      throw new Error('Unknown action')
  }
}

export default function Home () {
  const [state, dispatch] = useReducer(reducer, initialState, initializer)
  const [minutes, setMinutes] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [bell, setBell] = useState(false)

  const activeTask = state.tasks.find(f => f.id === state.active)

  useEffect(() => {
    const bellAudio = new Audio(bellSound)
    bellAudio.addEventListener('ended', () => {
      setBell(false)
    })

    console.log('bel audio is playing?', bell)
    bell ? bellAudio.play() : bellAudio.pause()
  }, [bell])

  useEffect(() => {
    localStorage.setItem('store', JSON.stringify(state))
  })

  useEffect(() => {
    let timerInterval = null
    if (state.active && activeTask) {
      const activeTimer = activeTask.timers.find(f => f.active)

      // Timer length
      let timer = 25
      if (activeTimer.isBreak) {
        timer = 5
      } else if (activeTimer.isLongBreak) {
        timer = 30
      }

      const endTimer = addSeconds(new Date(activeTimer.start), timer * 60)
      const diff = differenceInSeconds(endTimer, new Date())
      // console.log('time diff', activeTimer.start, diff)

      if (diff > 0 && timerInterval === null) {
        setMinutes(Math.floor(diff / 60))
        setSeconds(diff % 60)
      }

      timerInterval = setInterval(() => {
        if (seconds > 0) {
          setSeconds(seconds - 1)
        }
        if (seconds === 0) {
          if (minutes === 0) {
            startTimer(activeTask)
            setBell(true)
            notify('Task Ended!', 'Your timer is end')
            clearInterval(timerInterval)
          } else {
            setMinutes(minutes - 1)
            setSeconds(59)
          }
        }
      }, 1000)
    } else {
      setMinutes(0)
      setSeconds(0)
    }

    return () => {
      if (timerInterval) {
        clearInterval(timerInterval)
      }
    }
  })

  function onInputKeydown (e) {
    if (e.key === 'Enter') {
      dispatch({ type: 'add_task', payload: { id: (new Date()).getTime(), name: e.target.value } })
      e.target.value = ''
    }
  }

  function startTimer (task) {
    dispatch({ type: 'start_timer', id: task.id })
  }

  function deleteTask (task) {
    dispatch({ type: 'remove_task', id: task.id })
  }

  function getElapsed (task) {
    let seconds = 0

    if (task?.elapsed) {
      seconds = task.elapsed
    }

    let extra = 0
    if (activeTask?.id === task.id) {
      const activeTimer = activeTask.timers.find(f => f.active)
      if (activeTimer) {
        const endTimer = addSeconds(new Date(activeTimer.start), 0)
        const diff = differenceInSeconds(new Date(), endTimer)
        extra = diff
      }
    }
    const end = addSeconds(new Date(0), seconds + extra)
    const diff = differenceInSeconds(new Date(0), end)

    if (diff === 0) {
      return 'Not started'
    }

    return formatDistanceStrict(new Date(0), end)
  }

  function notify (title, body) {
    // Let's check if the browser supports notifications
    if (!('Notification' in window)) {
      alert('This browser does not support desktop notification')
    }

    // Let's check whether notification permissions have already been granted
    else if (Notification.permission === 'granted') {
    // If it's okay let's create a notification
      const notification = new Notification(title, { body })
      notification.onclick = function () {
        console.log('hello world')
        // window.open(window.location.href, '_self')
      }
    }

    // Otherwise, we need to ask the user for permission
    else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(function (permission) {
      // If the user accepts, let's create a notification
        if (permission === 'granted') {
          const notification = new Notification('Got It!', { body: 'Notification now is enabled' })
          notification.onclick = function () {
            console.log('hello world')
          }
        }
      })
    }
  }

  return (
    <div>
      <Head>
        <title>
          { activeTask ? `${String(minutes).padStart(2, 0)}:${String(seconds).padStart(2, 0)} | ${activeTask.name}` : 'Taskspill'}
        </title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="bg-gray-50 flex items-center justify-center min-h-screen">
        <div id="main" className="p-2 w-full max-w-lg">
          {/* <button onClick={() => notify('test', 'Test notification')}>test notif</button> */}
          {/* Timer */}
          <div className="flex flex-col items-center justify-center">
            <div
              id="timer"
              className="flex w-60 h-60 items-center justify-center px-4 py-8 text-6xl font-bold text-gray-800 bg-white rounded-full shadow-sm">
              {`${String(minutes).padStart(2, 0)}`}:{`${String(seconds).padStart(2, 0)}`}
            </div>
            {/* History */}
            <div id="task-history" className="flex items-center justify-start py-2 w-full max-w-lg flex-wrap">
              { activeTask?.timers?.map((m, i) =>
                <div key={i} className={`h-8 rounded mr-1 mb-2 ${m.isBreak || m.isLongBreak ? 'bg-gray-400' : 'bg-green-400'} ${m.active ? 'animate-pulse' : ''} ${m.isBreak ? 'w-2' : m.isLongBreak ? 'w-8' : 'w-6'}`}></div>
              )}
            </div>
            {/* Active Task Name */}
            { activeTask &&
            <div className="task-title text-lg font-medium text-gray-700 py-2">{activeTask?.name}</div>
            }
          </div>
          {/* New task input */}
          <div className="w-full">
            <input
              onKeyDown={onInputKeydown}
              type="text" placeholder="Add New Task?"
              className="px-3 py-2 border rounded w-full mt-4 focus:outline-none"/>
          </div>
          {/* Task list */}
          <div id="task-lists" className="mt-2">
            { state.tasks.map((i) =>
              <div key={i.id} className="tasks flex px-3 py-2 bg-white rounded shadow-sm mb-1 group">
                <div className="px-2 flex-grow">{ i.name }</div>
                <div className="elapsed group-hover:hidden text-sm text-gray-600">{ getElapsed(i) }</div>
                <div className="task-action items-center justify-center hidden group-hover:flex">
                  <button onClick={() => deleteTask(i)} className="focus:outline-none px-2">
                    <svg aria-hidden="true" focusable="false" data-prefix="fas" data-icon="trash" className="fill-current text-gray-600 hover:text-red-500 w-4 h-4" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M432 32H312l-9.4-18.7A24 24 0 0 0 281.1 0H166.8a23.72 23.72 0 0 0-21.4 13.3L136 32H16A16 16 0 0 0 0 48v32a16 16 0 0 0 16 16h416a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16zM53.2 467a48 48 0 0 0 47.9 45h245.8a48 48 0 0 0 47.9-45L416 128H32z"></path></svg>
                  </button>
                  <button onClick={() => startTimer(i)} className="focus:outline-none px-2">
                    { activeTask?.id !== i.id &&
                    <svg aria-hidden="true" focusable="false" data-prefix="far" data-icon="play-circle" className="fill-current text-gray-600 hover:text-blue-500 w-6 h-6" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M371.7 238l-176-107c-15.8-8.8-35.7 2.5-35.7 21v208c0 18.4 19.8 29.8 35.7 21l176-101c16.4-9.1 16.4-32.8 0-42zM504 256C504 119 393 8 256 8S8 119 8 256s111 248 248 248 248-111 248-248zm-448 0c0-110.5 89.5-200 200-200s200 89.5 200 200-89.5 200-200 200S56 366.5 56 256z"></path></svg>
                    }
                    { activeTask?.id === i.id &&
                    <svg aria-hidden="true" focusable="false" data-prefix="far" data-icon="pause-circle" className="fill-current text-gray-600 hover:text-blue-500 w-6 h-6" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm0 448c-110.5 0-200-89.5-200-200S145.5 56 256 56s200 89.5 200 200-89.5 200-200 200zm96-280v160c0 8.8-7.2 16-16 16h-48c-8.8 0-16-7.2-16-16V176c0-8.8 7.2-16 16-16h48c8.8 0 16 7.2 16 16zm-112 0v160c0 8.8-7.2 16-16 16h-48c-8.8 0-16-7.2-16-16V176c0-8.8 7.2-16 16-16h48c8.8 0 16 7.2 16 16z"></path></svg>
                    }
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
