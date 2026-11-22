import { Navigate, Route, Routes } from 'react-router'
import Layout from './components/Layout.jsx'
import AddMasterRule from './pages/AddMasterRule.jsx'
import AssignParts from './pages/AssignParts.jsx'
import Demo from './pages/Demo.jsx'
import JobCards from './pages/JobCards.jsx'
import MasterRuleView from './pages/MasterRuleView.jsx'
import OnboardVehicles from './pages/OnboardVehicles.jsx'
import Parts from './pages/Parts.jsx'
import PartsRule from './pages/PartsRule.jsx'
import ProjectedVehicles from './pages/ProjectedVehicles.jsx'
import ServiceHistory from './pages/ServiceHistory.jsx'
import ServicePartsDemo from './pages/ServicePartsDemo.jsx'
import Tags from './pages/Tags.jsx'
import Types from './pages/Types.jsx'
import UnplannedProjection from './pages/UnplannedProjection.jsx'

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/onboard-vehicles" replace />} />
        <Route path="onboard-vehicles" element={<OnboardVehicles />} />
        <Route path="projected-vehicles" element={<ProjectedVehicles />} />
        <Route path="projected-vehicles/:regNo" element={<ServiceHistory />} />
        <Route path="add-master-rule" element={<AddMasterRule />} />
        <Route path="master-rule-view" element={<MasterRuleView />} />
        <Route path="tags" element={<Tags />} />
        <Route path="types" element={<Types />} />
        <Route path="job-cards" element={<JobCards />} />
        <Route path="unplanned-projection" element={<UnplannedProjection />} />
        <Route path="parts" element={<Parts />} />
        <Route path="assign-parts" element={<AssignParts />} />
        <Route path="parts-rule" element={<PartsRule />} />
        <Route path="demo" element={<Demo />} />
        <Route path="service-parts-demo" element={<ServicePartsDemo />} />
        <Route path="*" element={<Navigate to="/onboard-vehicles" replace />} />
      </Route>
    </Routes>
  )
}

export default App
