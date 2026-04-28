import { useState } from 'react'
import { useGameStore } from '../../context/gameStore'
import { STARTER_TEMPLATES, StarterTemplateId } from '../../templates/starterTemplates'
import './StarterTemplates.css'

export default function StarterTemplates() {
    const pieceCount = useGameStore((state) => state.pieceCount)
    const wallCount = useGameStore((state) => state.walls.size)
    const applyStarterTemplate = useGameStore((state) => state.applyStarterTemplate)
    const [activeTemplate, setActiveTemplate] = useState<StarterTemplateId | null>(null)
    const [lastAppliedTemplateName, setLastAppliedTemplateName] = useState<string | null>(null)

    const isBlankRoom = pieceCount === 0 && wallCount === 0

    const handleApply = async (templateId: StarterTemplateId) => {
        const template = STARTER_TEMPLATES.find((candidate) => candidate.id === templateId)
        if (!template || !isBlankRoom || activeTemplate) return

        setActiveTemplate(templateId)
        setLastAppliedTemplateName(null)
        try {
            await applyStarterTemplate(templateId)
            setLastAppliedTemplateName(template.name)
        } catch {
            setLastAppliedTemplateName(null)
        } finally {
            setActiveTemplate(null)
        }
    }

    return (
        <div className="starter-templates" aria-label="Starter templates">
            <div className="starter-templates-header">
                <span className="starter-templates-label">Templates</span>
                {lastAppliedTemplateName && (
                    <span className="starter-templates-status">{lastAppliedTemplateName} added</span>
                )}
                {!lastAppliedTemplateName && !isBlankRoom && (
                    <span className="starter-templates-status">Blank room required</span>
                )}
            </div>

            <div className="starter-template-buttons">
                {STARTER_TEMPLATES.map((template) => (
                    <button
                        key={template.id}
                        type="button"
                        className="starter-template-button"
                        disabled={!isBlankRoom || activeTemplate !== null}
                        onClick={() => handleApply(template.id)}
                    >
                        <span className="starter-template-name">
                            {activeTemplate === template.id ? 'Building...' : template.name}
                        </span>
                        <span className="starter-template-meta">{template.piecesLabel}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}
