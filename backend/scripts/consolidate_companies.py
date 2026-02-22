"""
Script to consolidate duplicate companies in pharma_medications
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'focus_db')

async def consolidate_companies():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Company consolidation mapping
    consolidations = {
        'AstraZeneca': [
            'AstraZeneca España', 
            'AstraZeneca México', 
            'AstraZeneca México: Respiratorio', 
            'AstraZeneca México: Urología', 
            'AstraZeneca México: Vacunas e Inmunología'
        ],
        'Bristol Myers Squibb': [
            'BMS', 
            'Bristol Myers Squibb México: Oncología'
        ],
        'Merck': [
            'Merck & Co., Inc.', 
            'Merck México: Oncología', 
            'Merck México: Virología e Infecciosas'
        ],
        'Novartis': [
            'Novartis México: Oncología', 
            'Novartis México: Unidad de Retina y Oftalmología'
        ],
        'Pfizer': [
            'Pfizer México: Cardiología', 
            'Pfizer México: Dolor y Enfermedades Infecciosas', 
            'Pfizer México: Enfermedades Infecciosas', 
            'Pfizer México: Enfermedades Raras', 
            'Pfizer México: Enfermedades Respiratorias', 
            'Pfizer México: Inflamación e Inmunología', 
            'Pfizer México: Oncología', 
            'Pfizer México: Salud Respiratoria', 
            'Pfizer México: Salud de la Mujer', 
            'Pfizer México: Sistema Nervioso Central', 
            'Pfizer México: Vacunas', 
            'Pfizer USA'
        ],
        'Regeneron': [
            'Regeneron México: Unidad de Retina', 
            'Regeneron Pharmaceuticals Inc'
        ]
    }
    
    total_updated = 0
    for canonical, variations in consolidations.items():
        for variation in variations:
            result = await db.pharma_medications.update_many(
                {'empresa': variation},
                {'$set': {'empresa': canonical, 'empresa_original': variation}}
            )
            if result.modified_count > 0:
                print(f'  {variation} -> {canonical}: {result.modified_count} records')
                total_updated += result.modified_count
    
    print(f'\nTotal records updated: {total_updated}')
    
    # Verify new unique companies
    companies = await db.pharma_medications.distinct('empresa')
    print(f'\nNew unique companies: {len(companies)}')
    for c in sorted(companies):
        count = await db.pharma_medications.count_documents({'empresa': c})
        print(f'  - {c}: {count} records')
    
    client.close()

if __name__ == "__main__":
    asyncio.run(consolidate_companies())
