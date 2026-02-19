export const SCREENSHOT_REQUEST_EVENT = 'gingerbread:capture-screenshot'
export const SCREENSHOT_RESULT_EVENT = 'gingerbread:screenshot-result'

type ScreenshotResultDetail = {
    requestId: string
    success: boolean
    dataUrl?: string
    error?: string
}

/**
 * Ask the active 3D scene to render and return a screenshot data URL.
 */
export function requestSceneScreenshot(timeoutMs = 4000): Promise<string> {
    return new Promise((resolve, reject) => {
        const requestId = `shot_${Date.now()}_${Math.random().toString(36).slice(2)}`
        let settled = false

        const cleanup = () => {
            window.removeEventListener(SCREENSHOT_RESULT_EVENT, handleResult as EventListener)
            clearTimeout(timeout)
        }

        const handleResult = (event: CustomEvent<ScreenshotResultDetail>) => {
            if (event.detail?.requestId !== requestId || settled) {
                return
            }

            settled = true
            cleanup()

            if (event.detail.success && event.detail.dataUrl) {
                resolve(event.detail.dataUrl)
                return
            }

            reject(new Error(event.detail.error || 'Screenshot capture failed'))
        }

        const timeout = setTimeout(() => {
            if (settled) return
            settled = true
            cleanup()
            reject(new Error('Screenshot capture timed out'))
        }, timeoutMs)

        window.addEventListener(SCREENSHOT_RESULT_EVENT, handleResult as EventListener)
        window.dispatchEvent(new CustomEvent(SCREENSHOT_REQUEST_EVENT, { detail: { requestId } }))
    })
}
