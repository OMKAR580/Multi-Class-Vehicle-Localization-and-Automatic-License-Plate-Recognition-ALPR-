from ai.pipeline.schema import StandardAIOutputContract, VehicleBoundingBox, PlateBoundingBox

def __getattr__(name: str):
    if name == "ALPRPipeline":
        from ai.pipeline.alpr_pipeline import ALPRPipeline
        return ALPRPipeline
    raise AttributeError(f"module 'ai.pipeline' has no attribute '{name}'")

__all__ = [
    "StandardAIOutputContract",
    "VehicleBoundingBox",
    "PlateBoundingBox",
    "ALPRPipeline",
]
