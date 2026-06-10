'use strict'

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const INSTALL_DIR = path.join(os.homedir(), '.vexrtc')
const TASK_NAME = 'vexRTC-serve'
const VBS_FILE = path.join(INSTALL_DIR, 'start-hidden.vbs')

function electronPath() {
  return require(path.join(INSTALL_DIR, 'frontend', 'node_modules', 'electron'))
}

function install() {
  const electron = electronPath()
  const mainJs = path.join(INSTALL_DIR, 'frontend', 'electron', 'main.js')

  // VBScript wrapper hides the console window on startup
  const vbs = `Set sh = CreateObject("WScript.Shell")
sh.Run """${electron}"" ""${mainJs}""", 0, False`
  fs.writeFileSync(VBS_FILE, vbs)

  // Remove existing task silently before recreating
  try { run(`schtasks /delete /tn "${TASK_NAME}" /f`) } catch { /* ignore */ }

  run(`schtasks /create /tn "${TASK_NAME}" /sc ONLOGON /tr "wscript.exe \\"${VBS_FILE}\\"" /rl HIGHEST /f`)

  // Run immediately without waiting for next logon
  run(`schtasks /run /tn "${TASK_NAME}"`)
}

function uninstall() {
  try { run(`schtasks /end /tn "${TASK_NAME}"`) } catch { /* ignore */ }
  try { run(`schtasks /delete /tn "${TASK_NAME}" /f`) } catch { /* ignore */ }
}

function isRunning() {
  try {
    const out = execSync(`schtasks /query /tn "${TASK_NAME}" /fo LIST`, {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out.includes('Status:') && out.includes('Running')
  } catch { return false }
}

function run(cmd) {
  execSync(cmd, { windowsHide: true, stdio: 'inherit' })
}

module.exports = { install, uninstall, isRunning }
