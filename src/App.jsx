import { Navigate, Route, Routes } from 'react-router'
import Layout from './components/Layout.jsx'
import AddMasterRule from './pages/AddMasterRule.jsx'
import JobCards from './pages/JobCards.jsx'
import MasterRuleView from './pages/MasterRuleView.jsx'
import OnboardVehicles from './pages/OnboardVehicles.jsx'
import ProjectedVehicles from './pages/ProjectedVehicles.jsx'
import ServiceHistory from './pages/ServiceHistory.jsx'
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
        <Route path="*" element={<Navigate to="/onboard-vehicles" replace />} />
      </Route>
    </Routes>
  )
}

export default App
